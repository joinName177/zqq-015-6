import './ui/styles.css';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { KinshipAdapter } from './adapters/kinship.adapter';
import { MergedIdiomRepository } from './adapters/merged-repository.adapter';
import { OfflinePackageAdapter } from './adapters/offline-package.adapter';
import { IdiomProfile, KinshipResult } from './core/models';
import { ConflictStrategy, OfflineStore } from './core/package-types';
import { renderIdiomApp } from './ui/app';
import { OfflinePanelData } from './ui/offline-panel';

const dictAdapter = new DictionaryAdapter();
const kinshipAdapter = new KinshipAdapter();

// 离线数据存储：在线仓储与离线包适配器共享同一 store，
// 让离线查询与在线查询走同一模型、同一查询入口。
const store = new OfflineStore();
const mergedRepo = new MergedIdiomRepository(dictAdapter, store);
const offlineAdapter = new OfflinePackageAdapter(mergedRepo, kinshipAdapter, store);
offlineAdapter.loadPersisted();

let currentMode: 'single' | 'compare' = 'single';
let currentProfile: IdiomProfile;
let compareA = '守株待兔';
let compareB = '刻舟求剑';
let kinshipResult: KinshipResult | null = null;
let lastReport: OfflinePanelData['lastReport'] = null;

const rootEl = document.getElementById('app')!;

function collectOfflineData(): OfflinePanelData {
  return {
    presets: dictAdapter.getPresets(),
    offlineEntries: offlineAdapter.getOfflineEntries(),
    offlineRelationships: offlineAdapter.getOfflineRelationships(),
    lastReport
  };
}

function downloadTextFile(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function init() {
  currentProfile = await mergedRepo.getProfile('守株待兔');
  const profA = await mergedRepo.getProfile(compareA);
  const profB = await mergedRepo.getProfile(compareB);
  kinshipResult = kinshipAdapter.compareIdioms(profA, profB);
  refreshView();
}

function refreshView() {
  renderIdiomApp(
    rootEl,
    currentProfile,
    mergedRepo.getPresets(),
    currentMode,
    kinshipResult,
    compareA,
    compareB,
    {
      onSearch: async (text: string) => {
        currentProfile = await mergedRepo.getProfile(text);
        kinshipResult = null;
        refreshView();
      },
      onCompare: async (textA: string, textB: string) => {
        compareA = textA;
        compareB = textB;
        const pA = await mergedRepo.getProfile(textA);
        const pB = await mergedRepo.getProfile(textB);
        kinshipResult = kinshipAdapter.compareIdioms(pA, pB);
        refreshView();
      },
      onSwitchMode: (mode: 'single' | 'compare') => {
        currentMode = mode;
        refreshView();
      }
    },
    collectOfflineData(),
    {
      onExport: async (idioms: string[]) => {
        const pkg = await offlineAdapter.buildPackage(idioms);
        const text = offlineAdapter.serializePackage(pkg);
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        downloadTextFile(text, `idiom-offline-package-${stamp}.json`);
      },
      onImportFile: async (file: File, strategy: ConflictStrategy) => {
        const text = await file.text();
        const report = offlineAdapter.importPackage(text, strategy, file.name);
        lastReport = report;
        // 若当前展示词条受影响，刷新之
        currentProfile = await mergedRepo.getProfile(currentProfile.idiom);
        if (currentMode === 'compare') {
          const pA = await mergedRepo.getProfile(compareA);
          const pB = await mergedRepo.getProfile(compareB);
          kinshipResult = kinshipAdapter.compareIdioms(pA, pB);
        }
        refreshView();
      },
      onClearOffline: () => {
        offlineAdapter.clearOffline();
        lastReport = null;
        refreshView();
      }
    }
  );
}

init();
