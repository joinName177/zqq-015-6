import './ui/styles.css';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { KinshipAdapter } from './adapters/kinship.adapter';
import { IndexedDbOfflineAdapter } from './adapters/indexeddb-offline.adapter';
import {
  UnifiedIdiomRepository,
  OfflineMissError
} from './adapters/unified-repository.adapter';
import {
  OfflinePackService,
  downloadPack,
  readPackFile
} from './adapters/offline-pack.service';
import { IdiomProfile, KinshipResult } from './core/models';
import {
  LocalStoreStatus,
  ProfileEntry,
  MergeStrategy,
  InspectResult,
  isInspectFatal
} from './core/offline-pack';
import {
  renderIdiomApp,
  createEmptyOfflineState,
  OfflineUIState
} from './ui/app';

const dictAdapter = new DictionaryAdapter();
const kinshipAdapter = new KinshipAdapter();
const offlineStore = new IndexedDbOfflineAdapter();
const repository = new UnifiedIdiomRepository(dictAdapter, offlineStore);
const packService = new OfflinePackService(offlineStore);

let currentMode: 'single' | 'compare' = 'single';
let currentProfile: IdiomProfile;
let compareA = '守株待兔';
let compareB = '刻舟求剑';
let kinshipResult: KinshipResult | null = null;

let offline: OfflineUIState = createEmptyOfflineState(false);
let lastInspection: Exclude<InspectResult, { fatal: string }> | null = null;

const rootEl = document.getElementById('app')!;

/* ---------------- 离线资料库状态同步 ---------------- */

async function syncOfflineState() {
  let status: LocalStoreStatus | null = null;
  let entries: ProfileEntry[] = [];
  try {
    [status, entries] = await Promise.all([offlineStore.status(), offlineStore.getAllEntries()]);
  } catch (err) {
    console.warn('离线资料库不可用：', err);
    status = null;
  }
  offline.status = status;
  offline.cachedEntries = entries
    .map(e => ({
      key: e.profile.idiom.slice(0, 4),
      idiom: e.profile.idiom,
      revision: e.revision,
      source: e.source,
      updatedAt: e.updatedAt
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // 清理已不存在的选择
  const keySet = new Set(offline.cachedEntries.map(e => e.key));
  offline.selectedKeys = offline.selectedKeys.filter(k => keySet.has(k));
  refreshView();
}

/* ---------------- 视图渲染 ---------------- */

function refreshView() {
  renderIdiomApp(
    rootEl,
    currentProfile,
    repository.getPresets(),
    currentMode,
    kinshipResult,
    compareA,
    compareB,
    {
      onSearch: async (text: string) => {
        try {
          currentProfile = await repository.getProfile(text);
          kinshipResult = null;
          refreshView();
          await syncOfflineState();
        } catch (err) {
          if (err instanceof OfflineMissError) alert(err.message);
          else throw err;
        }
      },
      onCompare: async (textA: string, textB: string) => {
        compareA = textA;
        compareB = textB;
        try {
          const { result } = await repository.resolveComparison(
            textA,
            textB,
            (a, b) => kinshipAdapter.compareIdioms(a, b)
          );
          kinshipResult = result;
          refreshView();
          await syncOfflineState();
        } catch (err) {
          if (err instanceof OfflineMissError) alert(err.message);
          else throw err;
        }
      },
      onSwitchMode: (mode: 'single' | 'compare') => {
        currentMode = mode;
        refreshView();
      }
    },
    offline,
    {
      onToggleOfflineOnly: (value: boolean) => {
        offline.offlineOnly = value;
        repository.setOfflineOnly(value);
        refreshView();
      },
      onRefreshStatus: () => void syncOfflineState(),
      onToggleEntry: (key: string) => {
        const i = offline.selectedKeys.indexOf(key);
        if (i >= 0) offline.selectedKeys.splice(i, 1);
        else offline.selectedKeys.push(key);
        refreshView();
      },
      onSelectAllCached: () => {
        offline.selectedKeys = offline.cachedEntries.map(e => e.key);
        refreshView();
      },
      onClearSelection: () => {
        offline.selectedKeys = [];
        refreshView();
      },
      onExportPack: () => void handleExport(),
      onPickImportFile: () => {
        rootEl.querySelector<HTMLInputElement>('#packFileInput')?.click();
      },
      onImportStrategyChange: (strategy: MergeStrategy) => void handleRePreview(strategy),
      onEntryStrategyOverride: (key: string, strategy: MergeStrategy) =>
        void handleEntryOverride(key, strategy),
      onConfirmImport: () => void handleCommitImport(),
      onCancelImport: () => {
        offline.importView = 'idle';
        offline.importError = null;
        lastInspection = null;
        refreshView();
      },
      onClearCache: () =>
        void (async () => {
          await offlineStore.clear();
          offline.selectedKeys = [];
          await syncOfflineState();
        })()
    }
  );
}

/* ---------------- 导出离线包 ---------------- */

async function handleExport() {
  offline.exportMessage = null;
  if (offline.selectedKeys.length === 0) {
    offline.exportMessage = '⚠ 请先勾选至少一个词条。';
    refreshView();
    return;
  }
  offline.exporting = true;
  refreshView();
  try {
    const pack = await packService.exportSelected(offline.selectedKeys, {
      createdBy: 'zqq-015-web',
      description: `华夏成语字源离线包 · ${offline.selectedKeys.length} 词条`
    });
    downloadPack(pack);
    offline.exportMessage = `✓ 已生成离线包：${pack.manifest.entryCount} 词条 / ${pack.manifest.relationCount} 关系，校验和 ${pack.checksum}（v${pack.manifest.formatVersion}）。`;
  } catch (err) {
    offline.exportMessage = `✗ 导出失败：${(err as Error).message}`;
  } finally {
    offline.exporting = false;
    refreshView();
  }
}

/* ---------------- 导入：预检 → 冲突合并 → 落库 ---------------- */

rootEl.addEventListener('pack-file-selected', (ev: Event) => {
  const file = (ev as CustomEvent<{ file: File }>).detail.file;
  void handleImportFile(file);
});

async function handleImportFile(file: File) {
  offline.importView = 'preview';
  offline.importing = true;
  offline.importDone = false;
  offline.importError = null;
  offline.importFileName = file.name;
  offline.importStrategy = 'newer-wins';
  refreshView();

  try {
    const rawText = await readPackFile(file);
    const inspection = await packService.preview(rawText, 'newer-wins');
    applyInspection(inspection);
  } catch (err) {
    offline.importError = `文件读取失败：${(err as Error).message}`;
    refreshView();
  }
}

function applyInspection(inspection: InspectResult) {
  if (isInspectFatal(inspection)) {
    offline.importError = inspection.fatal;
    offline.importPlan = [];
    offline.importVersion = null;
    offline.importReport = null;
    lastInspection = null;
    refreshView();
    return;
  }
  lastInspection = inspection;
  offline.importError = null;
  offline.importVersion = inspection.version;
  offline.importPlan = inspection.plan;
  offline.importReport = inspection.report;
  offline.importSalvaged = inspection.salvaged;
  offline.importWarnings = inspection.report.warnings;
  offline.relationCountInPack = inspection.relations.length;
  offline.importing = false;
  refreshView();
}

async function handleRePreview(strategy: MergeStrategy) {
  if (!lastInspection) return;
  offline.importStrategy = strategy;
  // 切换默认策略时清除逐条覆盖
  const updated = await packService.rePreview(lastInspection, strategy, {});
  applyInspection(updated);
}

async function handleEntryOverride(key: string, strategy: MergeStrategy) {
  if (!lastInspection) return;
  const overrides: Record<string, MergeStrategy> = { [key]: strategy };
  const updated = await packService.rePreview(lastInspection, offline.importStrategy, overrides);
  applyInspection(updated);
}

async function handleCommitImport() {
  if (!lastInspection) return;
  offline.importing = true;
  refreshView();
  try {
    const report = await packService.commit(lastInspection);
    offline.importDone = true;
    offline.importReport = report;
    offline.importWarnings = report.warnings;
    offline.importing = false;
    refreshView();
    await syncOfflineState();
  } catch (err) {
    offline.importError = `导入事务失败，本地库保持原状：${(err as Error).message}`;
    offline.importing = false;
    refreshView();
  }
}

/* ---------------- 启动 ---------------- */

async function init() {
  currentProfile = await repository.getProfile('守株待兔');
  const profA = await repository.getProfile(compareA);
  const profB = await repository.getProfile(compareB);
  kinshipResult = kinshipAdapter.compareIdioms(profA, profB);
  await offlineStore.cacheRelation(kinshipResult);
  await syncOfflineState();
}

init();
