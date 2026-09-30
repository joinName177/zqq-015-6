import { IdiomProfile, KinshipResult } from '../core/models';
import {
  ProfileEntry,
  RelationEntry,
  LocalStoreStatus,
  OfflinePack
} from '../core/offline-pack';

/**
 * 离线资料库端口：
 * 在线 / 离线查询通过同一模型（IdiomProfile / KinshipResult）落库与读取，
 * 具体存储实现（IndexedDB、内存、其它后端）由适配器层提供。
 */
export interface OfflineStorePort {
  /** 读取本地缓存的词条；不存在时返回 null（在线/离线共用同一读取路径） */
  getEntry(key: string): Promise<ProfileEntry | null>;
  getAllEntries(): Promise<ProfileEntry[]>;
  putEntry(entry: ProfileEntry): Promise<void>;
  putEntries(entries: ProfileEntry[]): Promise<void>;
  removeEntry(key: string): Promise<void>;

  getRelation(key: string): Promise<RelationEntry | null>;
  getAllRelations(): Promise<RelationEntry[]>;
  putRelation(relation: RelationEntry): Promise<void>;
  putRelations(relations: RelationEntry[]): Promise<void>;

  /** 用导入合并后的完整集合替换本地数据（事务性导入） */
  replaceAll(entries: ProfileEntry[], relations: RelationEntry[]): Promise<void>;

  status(): Promise<LocalStoreStatus>;
  clear(): Promise<void>;

  /** 把在线模型以当前修订号写入本地缓存（在线查询 -> 离线可用） */
  cacheProfile(profile: IdiomProfile, source: ProfileEntry['source']): Promise<ProfileEntry>;
  cacheRelation(result: KinshipResult): Promise<RelationEntry>;

  /** 序列化本地库为离线包（下载） */
  exportPack(selectedKeys: string[], meta?: { createdBy?: string; description?: string }): Promise<OfflinePack>;
}
