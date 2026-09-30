import { IdiomProfile } from '../core/models';
import { IdiomRepositoryPort } from '../ports/idiom-repository.port';
import { OfflineStore } from '../core/package-types';

/**
 * 合并典籍仓储适配器
 *
 * 实现与在线适配器相同的 IdiomRepositoryPort，使在线检索与离线检索
 * 共享同一模型、同一查询入口：离线词条优先命中，未命中回退到在线典籍库。
 * UI 层面向端口编程，无需区分数据来源。
 */
export class MergedIdiomRepository implements IdiomRepositoryPort {
  constructor(
    private online: IdiomRepositoryPort,
    private store: OfflineStore
  ) {}

  async getProfile(idiomText: string): Promise<IdiomProfile> {
    const key = idiomText.trim().slice(0, 4);
    const offline = this.store.entries.get(key);
    if (offline) return offline;
    return this.online.getProfile(key);
  }

  getPresets(): string[] {
    const online = this.online.getPresets();
    const offline = [...this.store.entries.keys()];
    return [...new Set([...online, ...offline])];
  }
}
