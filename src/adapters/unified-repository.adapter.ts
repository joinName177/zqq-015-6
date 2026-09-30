import { IdiomProfile, KinshipResult } from '../core/models';
import { IdiomRepositoryPort } from '../ports/idiom-repository.port';
import { ProfileEntry } from '../core/offline-pack';
import { OfflineStorePort } from '../ports/offline-store.port';
import { normalizeKey } from '../core/offline-pack';

export interface QueryOutcome<T> {
  data: T;
  /** 本次结果来自离线库还是在线适配器 */
  origin: 'offline' | 'online';
}

/**
 * 统一资料库：在线查询与离线查询共享同一领域模型与同一读取路径。
 *
 *  - hybrid 模式（默认）：先查本地离线库，未命中再走在线适配器，
 *    在线结果会以同一 IdiomProfile 模型回写缓存，此后离线可用。
 *  - offline 模式：只读本地离线库，未命中时抛出明确错误（可回退到本地推演）。
 */
export class UnifiedIdiomRepository implements IdiomRepositoryPort {
  private presets: string[];

  constructor(
    private readonly online: IdiomRepositoryPort,
    private readonly store: OfflineStorePort
  ) {
    this.presets = online.getPresets();
  }

  setOfflineOnly(offlineOnly: boolean): void {
    this.offlineOnly = offlineOnly;
  }
  private offlineOnly = false;

  async getProfile(idiomText: string): Promise<IdiomProfile> {
    const outcome = await this.resolveProfile(idiomText);
    return outcome.data;
  }

  async resolveProfile(idiomText: string): Promise<QueryOutcome<IdiomProfile>> {
    const key = normalizeKey(idiomText);
    const cached = await this.store.getEntry(key);
    if (cached) {
      return { data: cached.profile, origin: 'offline' };
    }
    if (this.offlineOnly) {
      throw new OfflineMissError(key);
    }
    const profile = await this.online.getProfile(idiomText);
    // 内置富词条标记为 online；通用推演结果标记为 local-generated，二者模型完全一致
    const source: ProfileEntry['source'] = this.online.getPresets().includes(normalizeKey(profile.idiom))
      ? 'online'
      : 'local-generated';
    await this.store.cacheProfile(profile, source);
    return { data: profile, origin: 'online' };
  }

  /** 亲缘比对：优先使用库中词条与已缓存关系，保证离线结果与在线一致 */
  async resolveComparison(
    textA: string,
    textB: string,
    compare: (a: IdiomProfile, b: IdiomProfile) => KinshipResult
  ): Promise<{ result: KinshipResult; origins: { a: 'offline' | 'online'; b: 'offline' | 'online' } }> {
    const [outcomeA, outcomeB] = await Promise.all([
      this.resolveProfile(textA),
      this.resolveProfile(textB)
    ]);
    const result = compare(outcomeA.data, outcomeB.data);
    // 关系数据同样以共享模型落库，供离线包携带与离线比对复用
    await this.store.cacheRelation(result);
    return { result, origins: { a: outcomeA.origin, b: outcomeB.origin } };
  }

  getPresets(): string[] {
    return this.presets;
  }
}

/** 纯离线模式下本地库未命中 */
export class OfflineMissError extends Error {
  constructor(public readonly key: string) {
    super(`离线库中未收录词条「${key}」，请先在联网时下载或导入对应的离线资料包。`);
    this.name = 'OfflineMissError';
  }
}
