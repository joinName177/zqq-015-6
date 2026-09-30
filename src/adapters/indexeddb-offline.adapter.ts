import { IdiomProfile, KinshipResult } from '../core/models';
import {
  ProfileEntry,
  RelationEntry,
  LocalStoreStatus,
  OfflinePack,
  normalizeKey,
  relationKeyOf,
  createPack,
  CURRENT_PACK_VERSION,
  fnv1a
} from '../core/offline-pack';
import { OfflineStorePort } from '../ports/offline-store.port';

const DB_NAME = 'zqq015-offline-db';
const DB_STORE_VERSION = 1;
const ENTRY_STORE = 'entries';
const RELATION_STORE = 'relations';
const META_STORE = 'meta';
const META_REBUILT_KEY = 'rebuiltAt';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB，离线库不可用。'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_STORE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) db.createObjectStore(ENTRY_STORE, { keyPath: null });
      if (!db.objectStoreNames.contains(RELATION_STORE)) db.createObjectStore(RELATION_STORE, { keyPath: null });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  storeName: string | string[],
  mode: IDBTransactionMode,
  fn: (stores: IDBObjectStore[]) => IDBRequest<T> | IDBRequest<T>[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const names = Array.isArray(storeName) ? storeName : [storeName];
    const transaction = db.transaction(names, mode);
    const stores = names.map(n => transaction.objectStore(n));
    const requests = [fn(stores)].flat();
    const results: T[] = new Array(requests.length);
    let pending = requests.length;
    requests.forEach((r, i) => {
      r.onsuccess = () => {
        results[i] = r.result;
        pending--;
        if (pending === 0) resolve(results);
      };
      r.onerror = () => reject(r.error);
    });
    transaction.onerror = () => reject(transaction.error);
  });
}

/** IndexedDB 离线库适配器：键为归一化词条/关系键，值为共享领域模型 */
export class IndexedDbOfflineAdapter implements OfflineStorePort {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  async getEntry(key: string): Promise<ProfileEntry | null> {
    const db = await this.db();
    const [row] = await tx<ProfileEntry>(db, ENTRY_STORE, 'readonly', s => s[0].get(normalizeKey(key)));
    return (row as ProfileEntry) ?? null;
  }

  async getAllEntries(): Promise<ProfileEntry[]> {
    const db = await this.db();
    const [rows] = await tx<ProfileEntry[]>(db, ENTRY_STORE, 'readonly', s => s[0].getAll());
    return (rows as ProfileEntry[]) ?? [];
  }

  async putEntry(entry: ProfileEntry): Promise<void> {
    const db = await this.db();
    await tx(db, ENTRY_STORE, 'readwrite', s => s[0].put(entry, normalizeKey(entry.profile.idiom)));
  }

  async putEntries(entries: ProfileEntry[]): Promise<void> {
    const db = await this.db();
    await tx(db, ENTRY_STORE, 'readwrite', stores =>
      entries.map(e => stores[0].put(e, normalizeKey(e.profile.idiom)))
    );
  }

  async removeEntry(key: string): Promise<void> {
    const db = await this.db();
    await tx(db, ENTRY_STORE, 'readwrite', s => s[0].delete(normalizeKey(key)));
  }

  async getRelation(key: string): Promise<RelationEntry | null> {
    const db = await this.db();
    const [row] = await tx<RelationEntry>(db, RELATION_STORE, 'readonly', s => s[0].get(key));
    return (row as RelationEntry) ?? null;
  }

  async getAllRelations(): Promise<RelationEntry[]> {
    const db = await this.db();
    const [rows] = await tx<RelationEntry[]>(db, RELATION_STORE, 'readonly', s => s[0].getAll());
    return (rows as RelationEntry[]) ?? [];
  }

  async putRelation(relation: RelationEntry): Promise<void> {
    const db = await this.db();
    await tx(db, RELATION_STORE, 'readwrite', s => s[0].put(relation, relation.key));
  }

  async putRelations(relations: RelationEntry[]): Promise<void> {
    const db = await this.db();
    await tx(db, RELATION_STORE, 'readwrite', stores => relations.map(r => stores[0].put(r, r.key)));
  }

  /** 事务性整体替换：任一写入失败则中止事务，本地库不会处于半导入状态 */
  async replaceAll(entries: ProfileEntry[], relations: RelationEntry[]): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([ENTRY_STORE, RELATION_STORE, META_STORE], 'readwrite');
      const entryStore = transaction.objectStore(ENTRY_STORE);
      const relationStore = transaction.objectStore(RELATION_STORE);
      const metaStore = transaction.objectStore(META_STORE);
      entryStore.clear();
      relationStore.clear();
      entries.forEach(e => entryStore.put(e, normalizeKey(e.profile.idiom)));
      relations.forEach(r => relationStore.put(r, r.key));
      metaStore.put(new Date().toISOString(), META_REBUILT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('导入事务被中止'));
    });
  }

  async status(): Promise<LocalStoreStatus> {
    const db = await this.db();
    const [entries, relations, rebuiltAt] = await new Promise<[ProfileEntry[], RelationEntry[], string]>(
      (resolve, reject) => {
        const transaction = db.transaction([ENTRY_STORE, RELATION_STORE, META_STORE], 'readonly');
        const eReq = transaction.objectStore(ENTRY_STORE).getAll();
        const rReq = transaction.objectStore(RELATION_STORE).getAll();
        const mReq = transaction.objectStore(META_STORE).get(META_REBUILT_KEY);
        transaction.oncomplete = () =>
          resolve([eReq.result as ProfileEntry[], rReq.result as RelationEntry[], (mReq.result as string) ?? null]);
        transaction.onerror = () => reject(transaction.error);
      }
    );
    return {
      formatVersion: CURRENT_PACK_VERSION,
      entryCount: entries.length,
      relationCount: relations.length,
      rebuiltAt
    };
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([ENTRY_STORE, RELATION_STORE], 'readwrite');
      transaction.objectStore(ENTRY_STORE).clear();
      transaction.objectStore(RELATION_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 在线模型 -> 离线缓存：
   * 若内容指纹变化则 revision +1，未变化则原样保留（保证版本可比较）。
   */
  async cacheProfile(profile: IdiomProfile, source: ProfileEntry['source']): Promise<ProfileEntry> {
    const key = normalizeKey(profile.idiom);
    const existing = await this.getEntry(key);
    const fingerprint = fnv1a(JSON.stringify(profile));
    if (existing && fnv1a(JSON.stringify(existing.profile)) === fingerprint) {
      return existing;
    }
    const entry: ProfileEntry = {
      profile,
      revision: existing ? existing.revision + 1 : 1,
      source,
      updatedAt: new Date().toISOString()
    };
    await this.putEntry(entry);
    return entry;
  }

  async cacheRelation(result: KinshipResult): Promise<RelationEntry> {
    const keyA = normalizeKey(result.idiomA.idiom);
    const keyB = normalizeKey(result.idiomB.idiom);
    const key = relationKeyOf(keyA, keyB);
    const existing = await this.getRelation(key);
    const relation: RelationEntry = {
      key,
      keyA,
      keyB,
      result,
      revision: existing ? existing.revision + 1 : 1,
      updatedAt: new Date().toISOString()
    };
    await this.putRelation(relation);
    return relation;
  }

  async exportPack(
    selectedKeys: string[],
    meta?: { createdBy?: string; description?: string }
  ): Promise<OfflinePack> {
    const wanted = new Set(selectedKeys.map(normalizeKey));
    const [entries, allRelations] = await Promise.all([this.getAllEntries(), this.getAllRelations()]);
    const selected = entries.filter(e => wanted.has(normalizeKey(e.profile.idiom)));
    // 关系数据：随包携带被选中词条之间的所有关系
    const relations = allRelations.filter(r => wanted.has(r.keyA) && wanted.has(r.keyB));
    return createPack(selected, relations, meta);
  }
}
