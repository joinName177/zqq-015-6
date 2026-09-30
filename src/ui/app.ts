import { IdiomProfile, KinshipResult } from '../core/models';
import {
  LocalStoreStatus,
  ImportPlanEntry,
  MergeStrategy,
  VersionCheckResult,
  ImportReport
} from '../core/offline-pack';

export interface IdiomUIHandlers {
  onSearch: (idiomText: string) => void;
  onCompare: (idiomA: string, idiomB: string) => void;
  onSwitchMode: (mode: 'single' | 'compare') => void;
}

export interface OfflineUIHandlers {
  onToggleOfflineOnly: (offlineOnly: boolean) => void;
  onRefreshStatus: () => void;
  onToggleEntry: (key: string) => void;
  onSelectAllCached: () => void;
  onClearSelection: () => void;
  onExportPack: () => void;
  onPickImportFile: () => void;
  onImportStrategyChange: (strategy: MergeStrategy) => void;
  onEntryStrategyOverride: (key: string, strategy: MergeStrategy) => void;
  onConfirmImport: () => void;
  onCancelImport: () => void;
  onClearCache: () => void;
}

export interface OfflineUIState {
  status: LocalStoreStatus | null;
  offlineOnly: boolean;
  cachedEntries: { key: string; idiom: string; revision: number; source: string; updatedAt: string }[];
  selectedKeys: string[];
  exporting: boolean;
  exportMessage: string | null;
  importing: boolean;
  importView: 'idle' | 'preview';
  importFileName: string | null;
  importError: string | null;
  importVersion: VersionCheckResult | null;
  importPlan: ImportPlanEntry[];
  importStrategy: MergeStrategy;
  importReport: ImportReport | null;
  importDone: boolean;
  importSalvaged: boolean;
  importWarnings: string[];
  relationCountInPack: number;
}

export function createEmptyOfflineState(offlineOnly = false): OfflineUIState {
  return {
    status: null,
    offlineOnly,
    cachedEntries: [],
    selectedKeys: [],
    exporting: false,
    exportMessage: null,
    importing: false,
    importView: 'idle',
    importFileName: null,
    importError: null,
    importVersion: null,
    importPlan: [],
    importStrategy: 'newer-wins',
    importReport: null,
    importDone: false,
    importSalvaged: false,
    importWarnings: [],
    relationCountInPack: 0
  };
}

export function renderIdiomApp(
  container: HTMLElement,
  currentProfile: IdiomProfile,
  presets: string[],
  mode: 'single' | 'compare',
  kinshipResult: KinshipResult | null,
  compareA: string,
  compareB: string,
  handlers: IdiomUIHandlers,
  offline: OfflineUIState,
  offlineHandlers: OfflineUIHandlers
) {
  const esc = (s: string) =>
    s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));

  // DNA Donut Chart SVG
  const dna = currentProfile.dna;
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.8

  const origStroke = (dna.originalPercent / 100) * circumference;
  const extStroke = (dna.extendedPercent / 100) * circumference;
  const metaStroke = (dna.metaphoricalPercent / 100) * circumference;

  const origOffset = 0;
  const extOffset = -origStroke;
  const metaOffset = -(origStroke + extStroke);

  const dnaSvg = `
    <svg viewBox="0 0 180 180" width="180" height="180">
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#28241f" stroke-width="20" />
      <!-- Original meaning -->
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#52b788" stroke-width="20"
              stroke-dasharray="${origStroke} ${circumference}" stroke-dashoffset="${origOffset}"
              transform="rotate(-90 90 90)" />
      <!-- Extended meaning -->
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#d4af37" stroke-width="20"
              stroke-dasharray="${extStroke} ${circumference}" stroke-dashoffset="${extOffset}"
              transform="rotate(-90 90 90)" />
      <!-- Metaphorical meaning -->
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#c93b2b" stroke-width="20"
              stroke-dasharray="${metaStroke} ${circumference}" stroke-dashoffset="${metaOffset}"
              transform="rotate(-90 90 90)" />
      <text x="90" y="85" text-anchor="middle" font-size="12" fill="var(--ash)">语义核心</text>
      <text x="90" y="105" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff">${dna.polarity}</text>
    </svg>
  `;

  container.innerHTML = `
    <div class="idiom-app">
      <header class="app-header">
        <div class="brand-section">
          <div class="seal-icon">篆</div>
          <div>
            <h1>华夏成语字源与语义DNA图谱</h1>
            <p>CHINESE IDIOM ETYMOLOGY &amp; SEMANTIC DNA PROFILER · v1.1.0</p>
          </div>
        </div>
        <div class="mode-toggle">
          <button class="mode-btn ${mode === 'single' ? 'active' : ''}" id="btnModeSingle">单词溯源剖析</button>
          <button class="mode-btn ${mode === 'compare' ? 'active' : ''}" id="btnModeCompare">双词亲缘对比</button>
        </div>
      </header>

      ${renderOfflineBar(offline)}

      ${
        mode === 'single'
          ? `
        <!-- Single Mode Search Bar -->
        <section class="search-container">
          <div class="search-input-wrap">
            <input type="text" class="idiom-input" id="singleInput" value="${esc(currentProfile.idiom)}" placeholder="输入任意四字成语，如：破釜沉舟..." />
            <button class="btn-search" id="btnSingleSearch">开始解构</button>
          </div>
          <div class="preset-chips">
            <span style="color:var(--ash);">推荐典范成语：</span>
            ${presets.map(p => `<button class="chip" data-idiom="${p}">${p}</button>`).join('')}
          </div>
        </section>

        <!-- Idiom Hero Banner -->
        <section class="idiom-hero">
          <div class="hero-main">
            <h2>${esc(currentProfile.idiom)}</h2>
            <div class="hero-pinyin">${esc(currentProfile.pinyin)} · ${esc(currentProfile.syntacticRole)}</div>
            <div class="hero-desc">${esc(currentProfile.modernDefinition)}</div>
          </div>
          <div>
            <span class="polarity-badge ${currentProfile.dna.polarity}">感情色彩 · ${currentProfile.dna.polarity}</span>
          </div>
        </section>

        <!-- Main Content Grid -->
        <div class="content-grid">
          <!-- Left: Oracle breakdown & Allusion timeline -->
          <main>
            <!-- 1. Oracle Character Breakdown -->
            <div class="section-title">
              <span>🪓 四字字源与早期金石甲骨形态拆解</span>
            </div>
            <div class="oracle-cards-grid">
              ${currentProfile.characters
                .map(
                  ch => `
                <div class="oracle-card">
                  <div class="glyph-svg-wrap">
                    <svg viewBox="0 0 100 100">${ch.glyphSvg}</svg>
                  </div>
                  <div class="char-kanji">${ch.char}</div>
                  <div class="char-script-tag">${ch.scriptType} · 部首【${ch.radical}】</div>
                  <div class="char-origin-text"><strong>本义：</strong>${esc(ch.originalMeaning)}</div>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- 2. Historical Allusion Source -->
            <div class="section-title">
              <span>📜 典故出处考据时间轴</span>
            </div>
            <div class="history-panel">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:var(--bronze);font-size:16px;">${esc(currentProfile.allusion.classicBook)}</strong>
                <span style="font-size:12px;color:var(--ash);">${esc(currentProfile.allusion.dynasty)} · ${esc(currentProfile.allusion.author)}</span>
              </div>
              <p style="font-size:13px;color:var(--silk);margin-top:8px;">${esc(currentProfile.allusion.historicalEvent)}</p>
              <div class="allusion-quote">${esc(currentProfile.allusion.originalAncientQuote)}</div>
            </div>

            <!-- 3. Semantic Evolution Path -->
            <div class="section-title">
              <span>🧭 语义演变路径图 (Semantic Evolution)</span>
            </div>
            <div class="history-panel">
              <div class="evolution-path">
                ${currentProfile.evolutionPath
                  .map(
                    step => `
                  <div class="evolution-node">
                    <div class="evolution-era">${esc(step.era)} · 演进形态【${step.semanticCategory}】</div>
                    <div class="evolution-meaning">${esc(step.meaning)}</div>
                    <div style="font-size:11px;color:var(--ash);margin-top:2px;">语境实录：${esc(step.contextSample)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </main>

          <!-- Right: Semantic DNA Panel -->
          <aside class="dna-panel">
            <div class="section-title" style="width:100%;text-align:center;justify-content:center;">
              <span>🧬 成语语义DNA谱系</span>
            </div>

            <div class="dna-chart-wrap">
              ${dnaSvg}
            </div>

            <div class="dna-legend">
              <div class="legend-row">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:#52b788;display:inline-block;border-radius:2px;"></span>
                  <span>文字本义 (Literal)</span>
                </span>
                <strong style="color:#52b788;">${dna.originalPercent}%</strong>
              </div>
              <div class="legend-row">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:#d4af37;display:inline-block;border-radius:2px;"></span>
                  <span>情境引申义 (Extended)</span>
                </span>
                <strong style="color:#d4af37;">${dna.extendedPercent}%</strong>
              </div>
              <div class="legend-row">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:#c93b2b;display:inline-block;border-radius:2px;"></span>
                  <span>哲学比喻义 (Metaphorical)</span>
                </span>
                <strong style="color:#c93b2b;">${dna.metaphoricalPercent}%</strong>
              </div>
            </div>

            <div class="sememes-box">
              <div style="font-size:12px;color:var(--ash);margin-bottom:8px;">底层核心义原标签 (Sememes)：</div>
              <div>
                ${dna.coreSememes.map(s => `<span class="sememe-tag">${esc(s)}</span>`).join('')}
              </div>
            </div>
          </aside>
        </div>
      `
          : `
        <!-- Compare Mode -->
        <section class="kinship-arena">
          <div class="section-title">
            <span>⚖️ 两个成语的语义亲缘度与义原拓扑对比</span>
          </div>

          <div class="compare-inputs">
            <div>
              <label style="font-size:12px;color:var(--ash);display:block;margin-bottom:6px;">成语 A：</label>
              <input type="text" class="idiom-input" id="compareInputA" value="${esc(compareA)}" placeholder="成语A" />
            </div>
            <div class="vs-badge">VS</div>
            <div>
              <label style="font-size:12px;color:var(--ash);display:block;margin-bottom:6px;">成语 B：</label>
              <input type="text" class="idiom-input" id="compareInputB" value="${esc(compareB)}" placeholder="成语B" />
            </div>
          </div>

          <div style="text-align:center;">
            <button class="btn-search" id="btnRunCompare" style="padding:12px 36px;">开始亲缘度对比演算</button>
          </div>

          ${
            kinshipResult
              ? `
            <div class="kinship-result-card">
              <div class="score-banner">
                <div>
                  <div style="font-size:12px;color:var(--ash);">综合语义亲缘指数</div>
                  <div class="score-val">${kinshipResult.kinshipScore}<span style="font-size:18px;">%</span></div>
                  <span class="polarity-badge" style="display:inline-block;margin-top:6px;">
                    关系判定 · ${kinshipResult.relationshipLabel}
                  </span>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:13px;color:var(--silk);">
                    《${esc(kinshipResult.idiomA.idiom)}》 vs 《${esc(kinshipResult.idiomB.idiom)}》
                  </div>
                  <div style="font-size:12px;color:var(--ash);margin-top:4px;">
                    DNA向量拟合度: <strong>${kinshipResult.dnaVectorSimilarity}%</strong>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:16px;">
                <strong style="color:var(--bronze);font-size:13px;">共现重叠核心义原：</strong>
                <div style="margin-top:6px;">
                  ${
                    kinshipResult.sharedSememes.length > 0
                      ? kinshipResult.sharedSememes.map(s => `<span class="sememe-tag" style="border-color:var(--jade);color:var(--jade);">${esc(s)}</span>`).join('')
                      : '<span style="color:var(--ash);font-size:12px;">无显著交叠核心义原</span>'
                  }
                </div>
              </div>

              <div style="background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:6px;border-left:3px solid var(--bronze);">
                <strong style="color:var(--bronze);font-size:13px;display:block;margin-bottom:4px;">语义流派对比考据：</strong>
                <p style="font-size:13px;color:var(--silk);line-height:1.6;">${esc(kinshipResult.comparativeAnalysis)}</p>
              </div>
            </div>
          `
              : ''
          }
        </section>
      `
      }
    </div>
  `;

  // Attach event listeners
  container.querySelector('#btnModeSingle')?.addEventListener('click', () => handlers.onSwitchMode('single'));
  container.querySelector('#btnModeCompare')?.addEventListener('click', () => handlers.onSwitchMode('compare'));

  bindOfflineBar(container, offline, offlineHandlers);

  if (mode === 'single') {
    const singleInput = container.querySelector('#singleInput') as HTMLInputElement;
    container.querySelector('#btnSingleSearch')?.addEventListener('click', () => {
      const val = singleInput.value.trim();
      if (val) handlers.onSearch(val);
    });

    singleInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = singleInput.value.trim();
        if (val) handlers.onSearch(val);
      }
    });

    container.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const idiom = btn.getAttribute('data-idiom');
        if (idiom) handlers.onSearch(idiom);
      });
    });
  } else {
    container.querySelector('#btnRunCompare')?.addEventListener('click', () => {
      const a = (container.querySelector('#compareInputA') as HTMLInputElement).value.trim();
      const b = (container.querySelector('#compareInputB') as HTMLInputElement).value.trim();
      if (a && b) handlers.onCompare(a, b);
      else alert('请输入需要对比的两个成语');
    });
  }
}

/* =========================================================================
 * 离线资料包工具栏与导入向导
 * ========================================================================= */

function renderOfflineBar(offline: OfflineUIState): string {
  const s = offline.status;
  const rebuilt = s?.rebuiltAt ? new Date(s.rebuiltAt).toLocaleString('zh-CN') : '尚未导入';
  return `
  <section class="offline-bar">
    <div class="offline-status">
      <span class="offline-dot ${offline.offlineOnly ? 'is-offline' : 'is-online'}"></span>
      <div>
        <div class="offline-title">
          离线资料库
          <label class="offline-switch">
            <input type="checkbox" id="chkOfflineOnly" ${offline.offlineOnly ? 'checked' : ''} />
            <span>仅离线模式</span>
          </label>
        </div>
        <div class="offline-meta">
          ${s ? `已缓存 <strong>${s.entryCount}</strong> 词条 · <strong>${s.relationCount}</strong> 条亲缘关系 · 最近导入 ${rebuilt}` : '正在读取本地资料库…'}
        </div>
      </div>
    </div>
    <div class="offline-actions">
      <button class="off-btn" id="btnDownloadPack">⬇ 下载离线资料包</button>
      <button class="off-btn" id="btnImportPack">⬆ 导入离线资料包</button>
      <button class="off-btn ghost" id="btnRefreshStore">刷新</button>
      <button class="off-btn danger" id="btnClearCache">清空缓存</button>
    </div>
  </section>

  <section class="offline-pack-panel" id="exportPanel">
    <div class="opp-header">
      <span>📦 离线包词条选择（在线查询过的词条会自动缓存于此，勾选后可打包下载）</span>
      <span class="opp-count">已选 ${offline.selectedKeys.length} / ${offline.cachedEntries.length}</span>
    </div>
    ${
      offline.cachedEntries.length === 0
        ? `<div class="opp-empty">本地暂无缓存词条。先在联网状态下查询成语，或导入他人分享的离线资料包。</div>`
        : `
      <div class="opp-entry-list">
        ${offline.cachedEntries
          .map(
            e => `
          <label class="opp-entry ${offline.selectedKeys.includes(e.key) ? 'selected' : ''}">
            <input type="checkbox" class="chk-entry" data-key="${e.key}" ${
              offline.selectedKeys.includes(e.key) ? 'checked' : ''
            } />
            <span class="opp-idiom">${e.idiom}</span>
            <span class="opp-tag ${e.source}">${e.source === 'online' ? '在线典籍' : '本地推演'}</span>
            <span class="opp-rev">r${e.revision}</span>
          </label>`
          )
          .join('')}
      </div>
      <div class="opp-footer">
        <div class="opp-footer-left">
          <button class="off-btn small" id="btnSelectAll">全选</button>
          <button class="off-btn small ghost" id="btnSelectNone">取消全选</button>
        </div>
        <div>
          <span class="opp-hint">将连同所选词条之间的亲缘关系数据一并打包</span>
          <button class="off-btn primary" id="btnDoExport" ${offline.exporting ? 'disabled' : ''}>
            ${offline.exporting ? '打包中…' : '生成并下载 .zqpack.json'}
          </button>
        </div>
      </div>`
    }
    ${offline.exportMessage ? `<div class="opp-message">${offline.exportMessage}</div>` : ''}
  </section>

  ${offline.importView === 'preview' ? renderImportModal(offline) : ''}
  <input type="file" id="packFileInput" accept=".json,application/json" hidden />
  `;
}

function renderImportModal(offline: OfflineUIState): string {
  if (offline.importError) {
    return `
    <div class="import-modal-mask" id="importMask">
      <div class="import-modal">
        <div class="import-modal-header"><h3>离线资料包导入</h3></div>
        <div class="import-fatal">⛔ ${offline.importError}</div>
        <div class="import-modal-footer">
          <button class="off-btn" id="btnImportCancel">关闭</button>
        </div>
      </div>
    </div>`;
  }

  const v = offline.importVersion;
  const r = offline.importReport;
  const plan = offline.importPlan;
  const conflictCount = plan.filter(p => p.conflict === 'conflict').length;
  const newCount = plan.filter(p => p.conflict === 'new').length;
  const sameCount = plan.filter(p => p.conflict === 'identical').length;

  const strategyOptions: Array<{ value: MergeStrategy; label: string }> = [
    { value: 'newer-wins', label: '智能合并（时间新者胜）' },
    { value: 'overwrite', label: '以包内版本覆盖本地' },
    { value: 'skip', label: '保留本地，跳过冲突' }
  ];

  return `
  <div class="import-modal-mask" id="importMask">
    <div class="import-modal">
      <div class="import-modal-header">
        <h3>离线资料包导入向导</h3>
        <button class="import-x" id="btnImportCancel">×</button>
      </div>

      ${
        offline.importDone && r
          ? `
        <div class="import-done">
          <div class="import-done-title">✅ 导入完成</div>
          <ul class="import-stat-list">
            <li>新增词条 <strong>${r.accepted}</strong></li>
            <li>覆盖更新 <strong>${r.overwritten}</strong></li>
            <li>跳过相同/冲突 <strong>${r.skipped}</strong></li>
            <li>应用亲缘关系 <strong>${r.relationsApplied}</strong> 条 · 跳过 <strong>${r.relationsSkipped}</strong> 条</li>
            ${r.recoveredEntries > 0 ? `<li class="warn">损坏恢复词条 <strong>${r.recoveredEntries}</strong> 个</li>` : ''}
            ${r.recoveredRelations > 0 ? `<li class="warn">损坏恢复关系 <strong>${r.recoveredRelations}</strong> 条</li>` : ''}
          </ul>
          ${r.warnings.length ? `<div class="import-warnings">${r.warnings.map(w => `<div>⚠ ${w}</div>`).join('')}</div>` : ''}
          <div class="import-modal-footer">
            <button class="off-btn primary" id="btnImportDone">完成</button>
          </div>
        </div>`
          : `
      <div class="import-meta-grid">
        <div><span>文件</span><strong>${offline.importFileName ?? '-'}</strong></div>
        <div><span>版本校验</span>
          <strong class="verdict ${v?.status ?? ''}">
            ${v ? (v.status === 'compatible' ? '✓ 兼容' : v.status === 'upgradable' ? '⇧ 可升级导入' : '✗ 不兼容') : '-'}
            · v${v?.formatVersion ?? '?'}
          </strong>
        </div>
        <div><span>词条 / 关系</span><strong>${plan.length} / ${offline.relationCountInPack}</strong></div>
        <div><span>冲突预检</span><strong>${newCount} 新增 · ${conflictCount} 冲突 · ${sameCount} 相同</strong></div>
      </div>
      ${v?.reason ? `<div class="import-version-note">${v.reason}</div>` : ''}
      ${offline.importSalvaged ? '<div class="import-version-note warn">该文件经过损坏抢救流程，请仔细核对下方恢复内容。</div>' : ''}

      <div class="import-strategy-row">
        <label for="selStrategy">默认冲突合并策略：</label>
        <select id="selStrategy" class="import-select">
          ${strategyOptions
            .map(o => `<option value="${o.value}" ${offline.importStrategy === o.value ? 'selected' : ''}>${o.label}</option>`)
            .join('')}
        </select>
      </div>

      <div class="import-plan-list">
        ${plan
          .map(p => {
            const badge =
              p.conflict === 'new'
                ? '<span class="plan-badge new">新增</span>'
                : p.conflict === 'identical'
                  ? '<span class="plan-badge same">相同</span>'
                  : '<span class="plan-badge conflict">冲突</span>';
            const localRev = p.local ? `本地 r${p.local.revision}` : '本地无';
            return `
            <div class="plan-row ${p.conflict}">
              <div class="plan-row-main">
                ${badge}
                <span class="plan-idiom">${p.idiom}</span>
                <span class="plan-rev">包内 r${p.incoming.revision} · ${localRev}</span>
              </div>
              ${
                p.conflict === 'conflict'
                  ? `<select class="import-select tiny" data-override-key="${p.key}">
                      ${strategyOptions
                        .map(
                          o =>
                            `<option value="${o.value}" ${p.strategy === o.value ? 'selected' : ''}>${o.label}</option>`
                        )
                        .join('')}
                    </select>`
                  : ''
              }
            </div>`;
          })
          .join('')}
      </div>

      ${
        offline.importWarnings.length
          ? `<div class="import-warnings">${offline.importWarnings.map(w => `<div>⚠ ${w}</div>`).join('')}</div>`
          : ''
      }

      <div class="import-modal-footer">
        <button class="off-btn ghost" id="btnImportCancel">取消</button>
        <button class="off-btn primary" id="btnConfirmImport" ${offline.importing ? 'disabled' : ''}>
          ${offline.importing ? '合并写入中…' : '执行版本校验与冲突合并导入'}
        </button>
      </div>`
      }
    </div>
  </div>`;
}

function bindOfflineBar(container: HTMLElement, offline: OfflineUIState, h: OfflineUIHandlers) {
  container.querySelector<HTMLInputElement>('#chkOfflineOnly')?.addEventListener('change', e => {
    h.onToggleOfflineOnly((e.target as HTMLInputElement).checked);
  });
  container.querySelector('#btnDownloadPack')?.addEventListener('click', () => {
    document.getElementById('exportPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  container.querySelector('#btnImportPack')?.addEventListener('click', () => h.onPickImportFile());
  container.querySelector('#btnRefreshStore')?.addEventListener('click', () => h.onRefreshStatus());
  container.querySelector('#btnClearCache')?.addEventListener('click', () => {
    if (confirm('确定清空本地离线资料库的全部词条与关系缓存？此操作不可恢复。')) h.onClearCache();
  });
  container.querySelector('#btnSelectAll')?.addEventListener('click', () => h.onSelectAllCached());
  container.querySelector('#btnSelectNone')?.addEventListener('click', () => h.onClearSelection());
  container.querySelector('#btnDoExport')?.addEventListener('click', () => h.onExportPack());

  container.querySelectorAll<HTMLInputElement>('.chk-entry').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.getAttribute('data-key');
      if (key) h.onToggleEntry(key);
    });
  });

  const fileInput = container.querySelector<HTMLInputElement>('#packFileInput');
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      // 由 main 层接管读取；通过自定义事件传递文件
      container.dispatchEvent(new CustomEvent('pack-file-selected', { detail: { file } }));
    }
    fileInput.value = '';
  });

  // 导入向导内事件
  container.querySelector('#btnImportCancel')?.addEventListener('click', () => h.onCancelImport());
  container.querySelector('#btnImportDone')?.addEventListener('click', () => h.onCancelImport());
  container.querySelector('#selStrategy')?.addEventListener('change', e => {
    h.onImportStrategyChange((e.target as HTMLSelectElement).value as MergeStrategy);
  });
  container.querySelectorAll<HTMLSelectElement>('select[data-override-key]').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.getAttribute('data-override-key')!;
      h.onEntryStrategyOverride(key, sel.value as MergeStrategy);
    });
  });
  container.querySelector('#btnConfirmImport')?.addEventListener('click', () => h.onConfirmImport());
}
