import { IdiomProfile } from '../core/models';
import { ConflictStrategy, ImportReport, PackagedRelationship } from '../core/package-types';

/**
 * 离线资料包面板
 *
 * 提供词条勾选导出（自动打包亲缘关系）、离线包导入（版本校验/冲突合并/
 * 损坏恢复）、离线状态展示与导入报告。视觉沿用宣纸墨韵主题。
 */

export interface OfflinePanelData {
  presets: string[];
  offlineEntries: IdiomProfile[];
  offlineRelationships: PackagedRelationship[];
  lastReport: ImportReport | null;
}

export interface OfflinePanelHandlers {
  onExport: (idioms: string[]) => void;
  onImportFile: (file: File, strategy: ConflictStrategy) => void;
  onClearOffline: () => void;
}

const esc = (s: string) =>
  s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));

function fmtTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function renderReport(report: ImportReport): string {
  const conflictsHtml = report.conflicts.length
    ? `
    <div class="report-block">
      <h5>⚖️ 冲突合并明细（${report.conflicts.length}）</h5>
      <ul class="report-list">
        ${report.conflicts
          .map(
            c => `
          <li>
            <strong>《${esc(c.idiom)}》</strong>
            <span class="res-tag ${c.resolution}">${
              c.resolution === 'merged'
                ? '已合并'
                : c.resolution === 'overwritten'
                  ? '已覆盖'
                  : c.resolution === 'skipped'
                    ? '已跳过'
                    : '未变更'
            }</span>
            <span class="res-detail">${esc(c.detail)}</span>
          </li>`
          )
          .join('')}
      </ul>
    </div>`
    : '';

  const issuesHtml = report.issues.length
    ? `
    <div class="report-block">
      <h5>🔍 版本校验与损坏恢复记录（${report.issues.length}）</h5>
      <ul class="report-list">
        ${report.issues
          .map(
            i => `
          <li class="issue-${i.severity}">
            <span class="sev-tag ${i.severity}">${
              i.severity === 'recovered' ? '已恢复' : i.severity === 'skipped' ? '已跳过' : '严重'
            }</span>
            ${i.idiom ? `<strong>《${esc(i.idiom)}》</strong> ` : ''}
            <span class="res-detail">${esc(i.message)}</span>
          </li>`
          )
          .join('')}
      </ul>
    </div>`
    : '';

  const errorsHtml = report.errors.length
    ? `
    <div class="report-block report-errors">
      <h5>❌ 导入失败</h5>
      <ul class="report-list">
        ${report.errors.map(e => `<li>${esc(e)}</li>`).join('')}
      </ul>
    </div>`
    : '';

  return `
    <div class="import-report ${report.success ? 'ok' : 'fail'}">
      <div class="report-head">
        <strong>${report.success ? '✅ 离线包导入成功' : '❌ 离线包导入失败'}</strong>
        ${report.fileName ? `<span class="report-file">${esc(report.fileName)}</span>` : ''}
      </div>
      <div class="report-grid">
        <div class="report-cell"><span class="cell-label">格式版本</span><span class="cell-val">v${esc(report.formatVersion)}</span></div>
        <div class="report-cell"><span class="cell-label">应用版本</span><span class="cell-val">v${esc(report.appVersion)}</span></div>
        <div class="report-cell"><span class="cell-label">导出时间</span><span class="cell-val">${esc(fmtTime(report.exportedAt))}</span></div>
        <div class="report-cell"><span class="cell-label">整体校验和</span><span class="cell-val ${report.checksumValid ? 'ok' : 'warn'}">${report.checksumValid ? '✓ 完整' : '⚠ 不匹配·已抢救'}</span></div>
        <div class="report-cell"><span class="cell-label">词条导入</span><span class="cell-val">${report.importedEntries}/${report.totalEntries}（恢复 ${report.recoveredEntries} · 跳过 ${report.skippedEntries}）</span></div>
        <div class="report-cell"><span class="cell-label">关系导入</span><span class="cell-val">${report.importedRelationships}/${report.totalRelationships}（重复 ${report.duplicateRelationships}）</span></div>
      </div>
      ${conflictsHtml}
      ${issuesHtml}
      ${errorsHtml}
    </div>
  `;
}

export function renderOfflinePanel(data: OfflinePanelData): string {
  const allIdioms = [...new Set([...data.presets, ...data.offlineEntries.map(e => e.idiom)])];
  const offlinePairs = data.offlineRelationships
    .map(r => `${r.idiomA} × ${r.idiomB}`)
    .slice(0, 8);

  return `
    <details class="offline-panel" id="offlinePanel" open>
      <summary>
        <span class="op-title">📦 离线资料包</span>
        <span class="op-status">已载入离线词条 <b>${data.offlineEntries.length}</b> 个 · 亲缘关系 <b>${data.offlineRelationships.length}</b> 条</span>
      </summary>
      <div class="offline-body">
        <div class="offline-cols">
          <!-- 导出 -->
          <div class="offline-col">
            <h4>导出离线资料包</h4>
            <p class="op-hint">勾选词条，系统将打包词条资料及其两两亲缘关系数据，生成带版本号与校验和的离线文件。</p>
            <div class="export-select">
              <label class="exp-all"><input type="checkbox" id="expAll" checked /> 全选</label>
              <div class="exp-list" id="expList">
                ${allIdioms
                  .map(
                    idiom => `
                  <label class="exp-item"><input type="checkbox" class="exp-check" value="${esc(idiom)}" checked /> ${esc(idiom)}</label>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="export-add">
              <input type="text" id="expCustom" placeholder="追加自定义成语，如：画蛇添足" />
              <button class="btn-add" id="btnAddExport" type="button">添加</button>
            </div>
            <button class="btn-export" id="btnExport" type="button">⬇ 下载离线资料包 (.json)</button>
          </div>

          <!-- 导入 -->
          <div class="offline-col">
            <h4>导入离线资料包</h4>
            <p class="op-hint">选择离线包文件，导入时执行版本校验、冲突合并与损坏恢复，离线查询与在线查询共享同一模型。</p>
            <input type="file" id="impFile" accept=".json,application/json" />
            <select id="impStrategy">
              <option value="smart-merge">智能合并（推荐）：本地优先，缺失字段由离线包补全</option>
              <option value="skip-duplicates">跳过重复：保留本地版本</option>
              <option value="overwrite">覆盖：以离线包为准</option>
            </select>
            <button class="btn-import" id="btnImport" type="button">⬆ 导入并校验恢复</button>
            <div class="op-features">
              <span class="feat-tag">版本校验</span>
              <span class="feat-tag">冲突合并</span>
              <span class="feat-tag">损坏恢复</span>
            </div>
            <button class="btn-clear" id="btnClearOffline" type="button">清空离线数据</button>
          </div>
        </div>

        ${
          offlinePairs.length
            ? `<div class="offline-pairs"><span class="pairs-label">已载入关系：</span>${offlinePairs
                .map(p => `<span class="pair-tag">${esc(p)}</span>`)
                .join('')}${data.offlineRelationships.length > 8 ? `<span class="pair-more">等 ${data.offlineRelationships.length} 条</span>` : ''}</div>`
            : ''
        }

        <div id="reportSlot">${data.lastReport ? renderReport(data.lastReport) : ''}</div>
      </div>
    </details>
  `;
}

export function bindOfflinePanel(
  container: HTMLElement,
  data: OfflinePanelData,
  handlers: OfflinePanelHandlers
): void {
  const panel = container.querySelector('#offlinePanel');
  if (!panel) return;

  const expAll = panel.querySelector('#expAll') as HTMLInputElement | null;
  const expList = panel.querySelector('#expList') as HTMLElement | null;
  const expCustom = panel.querySelector('#expCustom') as HTMLInputElement | null;
  const btnAddExport = panel.querySelector('#btnAddExport') as HTMLButtonElement | null;
  const btnExport = panel.querySelector('#btnExport') as HTMLButtonElement | null;
  const impFile = panel.querySelector('#impFile') as HTMLInputElement | null;
  const impStrategy = panel.querySelector('#impStrategy') as HTMLSelectElement | null;
  const btnImport = panel.querySelector('#btnImport') as HTMLButtonElement | null;
  const btnClearOffline = panel.querySelector('#btnClearOffline') as HTMLButtonElement | null;
  const reportSlot = panel.querySelector('#reportSlot') as HTMLElement | null;

  function checkedIdioms(): string[] {
    if (!expList) return [];
    return [...expList.querySelectorAll<HTMLInputElement>('.exp-check')]
      .filter(c => c.checked)
      .map(c => c.value.trim())
      .filter(Boolean);
  }

  expAll?.addEventListener('change', () => {
    expList?.querySelectorAll<HTMLInputElement>('.exp-check').forEach(c => {
      c.checked = expAll.checked;
    });
  });

  expList?.addEventListener('change', () => {
    const checks = expList.querySelectorAll<HTMLInputElement>('.exp-check');
    const allChecked = [...checks].every(c => c.checked);
    if (expAll) expAll.checked = allChecked;
  });

  btnAddExport?.addEventListener('click', () => {
    const val = expCustom?.value.trim();
    if (!val || !expList) return;
    const exists = [...expList.querySelectorAll<HTMLInputElement>('.exp-check')].some(
      c => c.value === val
    );
    if (!exists) {
      const label = document.createElement('label');
      label.className = 'exp-item';
      label.innerHTML = `<input type="checkbox" class="exp-check" value="${esc(val)}" checked /> ${esc(val)}`;
      expList.appendChild(label);
    }
    if (expCustom) expCustom.value = '';
  });

  expCustom?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddExport?.click();
    }
  });

  btnExport?.addEventListener('click', () => {
    const idioms = checkedIdioms();
    if (idioms.length === 0) {
      alert('请至少勾选一个词条用于导出。');
      return;
    }
    handlers.onExport(idioms);
  });

  btnImport?.addEventListener('click', async () => {
    const file = impFile?.files?.[0];
    if (!file) {
      alert('请先选择要导入的离线资料包文件（.json）。');
      return;
    }
    const strategy = (impStrategy?.value as ConflictStrategy) || 'smart-merge';
    btnImport.disabled = true;
    btnImport.textContent = '导入校验中…';
    try {
      await handlers.onImportFile(file, strategy);
    } finally {
      btnImport.disabled = false;
      btnImport.textContent = '⬆ 导入并校验恢复';
      if (impFile) impFile.value = '';
    }
  });

  btnClearOffline?.addEventListener('click', () => {
    if (data.offlineEntries.length === 0) {
      alert('当前没有已载入的离线数据。');
      return;
    }
    if (confirm(`确定清空已载入的 ${data.offlineEntries.length} 个离线词条及其关系数据吗？此操作不可恢复。`)) {
      handlers.onClearOffline();
    }
  });

  // 暴露报告槽位更新能力（由主流程在导入后重渲染）
  (panel as unknown as { __reportSlot?: HTMLElement }).__reportSlot = reportSlot ?? undefined;
}
