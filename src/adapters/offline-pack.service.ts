import {
  OfflinePack,
  ImportReport,
  MergeStrategy,
  inspectPack,
  commitPlan,
  summarizePlan,
  isInspectFatal,
  InspectResult,
  ImportPlanEntry
} from '../core/offline-pack';
import { OfflineStorePort } from '../ports/offline-store.port';

/** 序列化为带缩进的 JSON 文本（离线包文件） */
export function serializePack(pack: OfflinePack): string {
  return JSON.stringify(pack, null, 2);
}

/** 浏览器下载：触发 .zqpack.json 文件保存 */
export function downloadPack(pack: OfflinePack): void {
  const blob = new Blob([serializePack(pack)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `idiom-offline-pack-${pack.manifest.entryCount}w-${stamp}.zqpack.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 读取用户选择的文件为文本 */
export function readPackFile(file: File): Promise<string> {
  return file.text();
}

export type ValidInspection = Exclude<InspectResult, { fatal: string }>;

export class OfflinePackService {
  constructor(private readonly store: OfflineStorePort) {}

  /** 下载选定词条（及其相互关系）的离线包 */
  async exportSelected(
    selectedKeys: string[],
    meta?: { createdBy?: string; description?: string }
  ): Promise<OfflinePack> {
    if (selectedKeys.length === 0) throw new Error('请至少选择一个词条再下载离线包。');
    return this.store.exportPack(selectedKeys, meta);
  }

  /** 预检：版本校验、冲突合并预演、损坏恢复（只读，不落库） */
  async preview(rawText: string, strategy: MergeStrategy): Promise<InspectResult> {
    const locals = await this.store.getAllEntries();
    return inspectPack(rawText, locals, { strategy });
  }

  /** 按（默认策略 + 逐条覆盖）重新预演，不重新解析文件 */
  async rePreview(
    result: ValidInspection,
    defaultStrategy: MergeStrategy,
    overrides: Record<string, MergeStrategy>
  ): Promise<ValidInspection> {
    const locals = await this.store.getAllEntries();
    const plan: ImportPlanEntry[] = result.plan.map(item => ({
      ...item,
      strategy: overrides[item.key] ?? defaultStrategy
    }));
    const baseWarnings = result.report.warnings.filter(w => !w.startsWith('关系「'));
    const report = summarizePlan(plan, locals, [], result.relations);
    report.recoveredEntries = result.report.recoveredEntries;
    report.recoveredRelations = result.report.recoveredRelations;
    report.warnings = [...baseWarnings.filter(w => !report.warnings.includes(w)), ...report.warnings];
    return { ...result, plan, report };
  }

  /** 确认导入：事务性替换本地库，返回导入报告 */
  async commit(result: ValidInspection, overrides?: Record<string, MergeStrategy>): Promise<ImportReport> {
    const [locals, existingRelations] = await Promise.all([
      this.store.getAllEntries(),
      this.store.getAllRelations()
    ]);
    const plan = overrides
      ? result.plan.map(item => ({ ...item, strategy: overrides[item.key] ?? item.strategy }))
      : result.plan;

    const { merged, relations, report } = commitPlan(plan, locals, result.relations, existingRelations);
    report.recoveredEntries = result.report.recoveredEntries;
    report.recoveredRelations = result.report.recoveredRelations;
    await this.store.replaceAll(merged, relations);
    return report;
  }
}

export { isInspectFatal };
