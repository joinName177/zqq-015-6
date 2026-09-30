import { IdiomProfile } from '../core/models';
import { IdiomRepositoryPort } from '../ports/idiom-repository.port';
import { KinshipPort } from '../ports/kinship.port';
import { OfflinePackagePort } from '../ports/offline-package.port';
import {
  ConflictStrategy,
  ImportReport,
  OfflinePackage,
  OfflineStore,
  PackagedEntry,
  PackagedRelationship,
  relKey
} from '../core/package-types';
import { createPackage, hashProfile, importAndMerge } from '../core/package-engine';

const STORAGE_KEY = 'zqq-offline-store-v1';

/**
 * 离线资料包适配器
 *
 * 构建离线包时通过 IdiomRepositoryPort 拉取词条（在线/离线统一入口），
 * 并通过 KinshipPort 计算两两亲缘关系；导入时委托 package-engine 完成
 * 版本校验、冲突合并与损坏恢复；离线数据持久化到 localStorage。
 */
export class OfflinePackageAdapter implements OfflinePackagePort {
  constructor(
    private repository: IdiomRepositoryPort,
    private kinship: KinshipPort,
    private store: OfflineStore
  ) {}

  async buildPackage(idiomTexts: string[]): Promise<OfflinePackage> {
    const unique = [...new Set(idiomTexts.map(t => t.trim().slice(0, 4)).filter(Boolean))];
    const profiles = await Promise.all(unique.map(t => this.repository.getProfile(t)));

    const entries: PackagedEntry[] = profiles.map(p => {
      const source: PackagedEntry['source'] = this.store.entries.has(p.idiom)
        ? 'offline'
        : p.id.startsWith('custom-')
          ? 'custom'
          : 'builtin';
      return { idiom: p.idiom, profile: p, source, contentHash: hashProfile(p) };
    });

    const relationships: PackagedRelationship[] = [];
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const k = this.kinship.compareIdioms(profiles[i], profiles[j]);
        relationships.push({
          idiomA: profiles[i].idiom,
          idiomB: profiles[j].idiom,
          kinship: k,
          computedAt: new Date().toISOString()
        });
      }
    }

    return createPackage(entries, relationships);
  }

  serializePackage(pkg: OfflinePackage): string {
    return JSON.stringify(pkg, null, 2);
  }

  importPackage(rawText: string, strategy: ConflictStrategy, fileName?: string): ImportReport {
    const { report } = importAndMerge(rawText, this.store, strategy, fileName);
    if (report.success) this.persist();
    return report;
  }

  getOfflineEntries(): IdiomProfile[] {
    return [...this.store.entries.values()];
  }

  getOfflineRelationships(): PackagedRelationship[] {
    return [...this.store.relationships];
  }

  getOfflineCount(): number {
    return this.store.entries.size;
  }

  persist(): void {
    try {
      const data = {
        entries: [...this.store.entries.entries()],
        relationships: this.store.relationships
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* 存储不可用时静默降级 */
    }
  }

  loadPersisted(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { entries?: unknown; relationships?: unknown };
      if (Array.isArray(data.entries)) {
        for (const pair of data.entries) {
          if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && pair[1]) {
            this.store.entries.set(pair[0], pair[1] as IdiomProfile);
          }
        }
      }
      if (Array.isArray(data.relationships)) {
        for (const ro of data.relationships) {
          const r = ro as PackagedRelationship;
          if (r && typeof r.idiomA === 'string' && typeof r.idiomB === 'string') {
            this.store.relationships.push(r);
            this.store.relationshipKeys.add(relKey(r.idiomA, r.idiomB));
          }
        }
      }
    } catch {
      /* 持久化数据损坏时忽略，不影响在线查询 */
    }
  }

  clearOffline(): void {
    this.store.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
