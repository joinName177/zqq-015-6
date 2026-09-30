import { IdiomProfile } from '../core/models';
import {
  ConflictStrategy,
  ImportReport,
  OfflinePackage,
  PackagedRelationship
} from '../core/package-types';

/**
 * 离线资料包端口
 *
 * 负责离线包的导出构建、导入解析、冲突合并与损坏恢复，
 * 并维护离线词条/关系数据的持久化存储。
 */
export interface OfflinePackagePort {
  /** 根据选定词条构建离线包（自动计算两两亲缘关系） */
  buildPackage(idiomTexts: string[]): Promise<OfflinePackage>;
  /** 序列化为可下载的 JSON 文本 */
  serializePackage(pkg: OfflinePackage): string;
  /** 导入原始文件文本，执行版本校验、冲突合并与损坏恢复，返回导入报告 */
  importPackage(rawText: string, strategy: ConflictStrategy, fileName?: string): ImportReport;
  /** 当前已载入的离线词条 */
  getOfflineEntries(): IdiomProfile[];
  /** 当前已载入的离线关系数据 */
  getOfflineRelationships(): PackagedRelationship[];
  /** 离线词条数量 */
  getOfflineCount(): number;
  /** 持久化到 localStorage */
  persist(): void;
  /** 从 localStorage 载入 */
  loadPersisted(): void;
  /** 清空全部离线数据 */
  clearOffline(): void;
}
