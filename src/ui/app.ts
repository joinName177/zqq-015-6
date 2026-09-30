import { IdiomProfile, KinshipResult } from '../core/models';

export interface IdiomUIHandlers {
  onSearch: (idiomText: string) => void;
  onCompare: (idiomA: string, idiomB: string) => void;
  onSwitchMode: (mode: 'single' | 'compare') => void;
}

export function renderIdiomApp(
  container: HTMLElement,
  currentProfile: IdiomProfile,
  presets: string[],
  mode: 'single' | 'compare',
  kinshipResult: KinshipResult | null,
  compareA: string,
  compareB: string,
  handlers: IdiomUIHandlers
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
            <p>CHINESE IDIOM ETYMOLOGY &amp; SEMANTIC DNA PROFILER · v1.0.0</p>
          </div>
        </div>
        <div class="mode-toggle">
          <button class="mode-btn ${mode === 'single' ? 'active' : ''}" id="btnModeSingle">单词溯源剖析</button>
          <button class="mode-btn ${mode === 'compare' ? 'active' : ''}" id="btnModeCompare">双词亲缘对比</button>
        </div>
      </header>

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
