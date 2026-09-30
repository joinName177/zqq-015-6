import { IdiomProfile, KinshipResult } from './models';

/**
 * 离线资料包领域模型
 *
 * 离线包是一个自包含的 JSON 文档：包含若干词条（IdiomProfile 快照）
 * 以及词条之间的亲缘关系数据（KinshipResult 快照），并附带版本清单
 * 与整体校验和，用于版本校验、冲突合并与损坏恢复。
 */

export const PACKAGE_FORMAT = 'idiom-offline-package';
export const PACKAGE_FORMAT_VERSION = '1.0.0';
export const APP_VERSION = '1.0.0';

/** 离线包清单（元数据） */
export interface PackageManifest {
  format: typeof PACKAGE_FORMAT;
  formatVersion: string;   // 包格式版本（semver）
  appVersion: string;       // 生成该包的应用版本
  exportedAt: string;       // ISO 时间戳
  generator: string;        // 生成器标识
  entryCount: number;
  relationshipCount: number;
}

/** 打包的词条（含来源与内容哈希） */
export interface PackagedEntry {
  idiom: string;
  profile: IdiomProfile;
  source: 'builtin' | 'custom' | 'offline';
  contentHash: string;      // 词条内容哈希，用于损坏检测
}

/** 打包的亲缘关系数据（两两一对，顺序无关） */
export interface PackagedRelationship {
  idiomA: string;
  idiomB: string;
  kinship: KinshipResult;
  computedAt: string;
}

/** 完整离线包 */
export interface OfflinePackage {
  manifest: PackageManifest;
  entries: PackagedEntry[];
  relationships: PackagedRelationship[];
  checksum: string;         // 对 manifest + entries + relationships 的整体校验和
}

/** 导入时的冲突合并策略 */
export type ConflictStrategy = 'smart-merge' | 'skip-duplicates' | 'overwrite';

/** 词条冲突记录 */
export interface EntryConflict {
  idiom: string;
  reason: 'duplicate' | 'content-differs' | 'version-mismatch';
  resolution: 'merged' | 'skipped' | 'overwritten' | 'unchanged';
  detail: string;
}

/** 损坏/恢复问题记录 */
export interface CorruptionIssue {
  idiom?: string;
  stage: 'parse' | 'manifest' | 'entry' | 'relationship' | 'checksum';
  severity: 'recovered' | 'skipped' | 'fatal';
  message: string;
}

/** 导入报告 */
export interface ImportReport {
  success: boolean;
  fileName?: string;
  formatVersion: string;
  appVersion: string;
  exportedAt: string;
  checksumValid: boolean;
  totalEntries: number;
  importedEntries: number;
  recoveredEntries: number;
  skippedEntries: number;
  totalRelationships: number;
  importedRelationships: number;
  duplicateRelationships: number;
  conflicts: EntryConflict[];
  issues: CorruptionIssue[];
  errors: string[];
  strategy: ConflictStrategy;
}

/** 关系键（顺序无关，用于去重） */
export function relKey(a: string, b: string): string {
  return [a, b].map(s => s.trim()).sort().join('||');
}

/**
 * 离线数据存储（内存态 + 可持久化到 localStorage）
 *
 * 在线仓储与离线包适配器共享同一个 store，从而让离线查询与在线查询
 * 走同一模型、同一查询入口。
 */
export class OfflineStore {
  entries = new Map<string, IdiomProfile>();
  relationships: PackagedRelationship[] = [];
  relationshipKeys = new Set<string>();

  clear(): void {
    this.entries.clear();
    this.relationships = [];
    this.relationshipKeys.clear();
  }
}
