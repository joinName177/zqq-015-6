import { IdiomProfile, KinshipResult, OracleChar, AllusionSource, SemanticEvolutionStep, SemanticDNA } from './models';
import { generateGenericIdiom } from './etymology-engine';
import {
  APP_VERSION,
  PACKAGE_FORMAT,
  PACKAGE_FORMAT_VERSION,
  ConflictStrategy,
  CorruptionIssue,
  EntryConflict,
  ImportReport,
  OfflinePackage,
  OfflineStore,
  PackagedEntry,
  PackagedRelationship,
  relKey
} from './package-types';

/* ------------------------------------------------------------------ */
/* 哈希与稳定序列化                                                     */
/* ------------------------------------------------------------------ */

/** FNV-1a 32 位哈希，输出 8 位十六进制 */
export function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

/** 递归按 key 字典序稳定序列化，保证同内容产生同字符串 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** 词条内容哈希 */
export function hashProfile(profile: IdiomProfile): string {
  return 'fnv1a32:' + hashString(stableStringify(profile));
}

/** 整体校验和（不含 checksum 字段本身） */
export function computeChecksum(
  manifest: OfflinePackage['manifest'],
  entries: PackagedEntry[],
  relationships: PackagedRelationship[]
): string {
  const payload = stableStringify({ manifest, entries, relationships });
  return 'fnv1a32:' + hashString(payload);
}

/* ------------------------------------------------------------------ */
/* 构建离线包                                                           */
/* ------------------------------------------------------------------ */

export function createPackage(
  entries: PackagedEntry[],
  relationships: PackagedRelationship[]
): OfflinePackage {
  const manifest: OfflinePackage['manifest'] = {
    format: PACKAGE_FORMAT,
    formatVersion: PACKAGE_FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    generator: 'zqq-015',
    entryCount: entries.length,
    relationshipCount: relationships.length
  };
  const checksum = computeChecksum(manifest, entries, relationships);
  return { manifest, entries, relationships, checksum };
}

/* ------------------------------------------------------------------ */
/* 版本校验                                                             */
/* ------------------------------------------------------------------ */

function parseSemver(v: string): [number, number, number] {
  const parts = (v || '').split('.').map(n => parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function checkVersion(formatVersion: string): CorruptionIssue[] {
  const issues: CorruptionIssue[] = [];
  if (!formatVersion) {
    issues.push({ stage: 'manifest', severity: 'recovered', message: '缺少格式版本号，已按当前版本处理。' });
    return issues;
  }
  const [major] = parseSemver(formatVersion);
  const [currentMajor] = parseSemver(PACKAGE_FORMAT_VERSION);
  if (major > currentMajor) {
    issues.push({
      stage: 'manifest',
      severity: 'fatal',
      message: `包格式版本 v${formatVersion} 高于当前支持的 v${PACKAGE_FORMAT_VERSION}，请升级系统后再导入。`
    });
  } else if (major < currentMajor) {
    issues.push({
      stage: 'manifest',
      severity: 'recovered',
      message: `包格式版本 v${formatVersion} 较旧，已兼容导入并升级到 v${PACKAGE_FORMAT_VERSION}。`
    });
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* 条目级校验与修复                                                     */
/* ------------------------------------------------------------------ */

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** 校验并尽可能修复一个词条 profile，无法修复时返回 null */
function coerceProfile(p: unknown, idiom: string, issues: CorruptionIssue[]): IdiomProfile | null {
  if (!p || typeof p !== 'object') return null;
  const src = p as Record<string, unknown>;
  const base = generateGenericIdiom(idiom);
  const recovered: string[] = [];

  let characters: OracleChar[] = base.characters;
  if (
    Array.isArray(src.characters) &&
    src.characters.length === 4 &&
    src.characters.every((c: unknown) => !!c && typeof (c as OracleChar).char === 'string')
  ) {
    characters = src.characters as OracleChar[];
  } else {
    recovered.push('characters(字形)');
  }

  let allusion: AllusionSource = base.allusion;
  if (src.allusion && typeof src.allusion === 'object' && typeof (src.allusion as AllusionSource).classicBook === 'string') {
    allusion = src.allusion as AllusionSource;
  } else {
    recovered.push('allusion(典故)');
  }

  let evolutionPath: SemanticEvolutionStep[] = base.evolutionPath;
  if (
    Array.isArray(src.evolutionPath) &&
    src.evolutionPath.length > 0 &&
    src.evolutionPath.every((s: unknown) => !!s && typeof (s as SemanticEvolutionStep).meaning === 'string')
  ) {
    evolutionPath = src.evolutionPath as SemanticEvolutionStep[];
  } else {
    recovered.push('evolutionPath(演变路径)');
  }

  let dna: SemanticDNA = base.dna;
  if (
    src.dna &&
    typeof src.dna === 'object' &&
    isNum((src.dna as SemanticDNA).originalPercent) &&
    isNum((src.dna as SemanticDNA).extendedPercent) &&
    isNum((src.dna as SemanticDNA).metaphoricalPercent)
  ) {
    dna = src.dna as SemanticDNA;
  } else {
    recovered.push('dna(语义DNA)');
  }

  if (typeof src.pinyin !== 'string') recovered.push('pinyin(拼音)');
  if (typeof src.modernDefinition !== 'string') recovered.push('modernDefinition(现代释义)');
  if (typeof src.syntacticRole !== 'string') recovered.push('syntacticRole(语法功能)');

  const profile: IdiomProfile = {
    id: typeof src.id === 'string' ? src.id : base.id,
    idiom: typeof src.idiom === 'string' ? src.idiom : idiom,
    pinyin: typeof src.pinyin === 'string' ? src.pinyin : base.pinyin,
    characters,
    allusion,
    evolutionPath,
    dna,
    modernDefinition: typeof src.modernDefinition === 'string' ? src.modernDefinition : base.modernDefinition,
    syntacticRole: typeof src.syntacticRole === 'string' ? src.syntacticRole : base.syntacticRole
  };

  if (recovered.length) {
    issues.push({
      idiom,
      stage: 'entry',
      severity: 'recovered',
      message: `词条《${idiom}》缺失字段 [${recovered.join('、')}] 已补全修复。`
    });
  }
  return profile;
}

function validateEntry(eo: unknown, issues: CorruptionIssue[]): PackagedEntry | null {
  if (!eo || typeof eo !== 'object') {
    issues.push({ stage: 'entry', severity: 'skipped', message: '词条条目结构无效，已跳过。' });
    return null;
  }
  const src = eo as Record<string, unknown>;
  const idiom =
    typeof src.idiom === 'string' && src.idiom.trim()
      ? src.idiom.trim()
      : typeof (src.profile as Record<string, unknown> | undefined)?.idiom === 'string'
        ? String((src.profile as Record<string, unknown>).idiom).trim()
        : '';
  if (!idiom) {
    issues.push({ stage: 'entry', severity: 'skipped', message: '词条缺少成语字段，已跳过。' });
    return null;
  }
  const profile = coerceProfile(src.profile, idiom, issues);
  if (!profile) {
    issues.push({ idiom, stage: 'entry', severity: 'skipped', message: `词条《${idiom}》资料严重缺失且无法修复，已跳过。` });
    return null;
  }
  const contentHash = typeof src.contentHash === 'string' ? src.contentHash : hashProfile(profile);
  const source: PackagedEntry['source'] =
    src.source === 'builtin' || src.source === 'custom' || src.source === 'offline' ? src.source : 'custom';
  return { idiom, profile, source, contentHash };
}

function validateRelationship(ro: unknown, issues: CorruptionIssue[]): PackagedRelationship | null {
  if (!ro || typeof ro !== 'object') {
    issues.push({ stage: 'relationship', severity: 'skipped', message: '关系数据结构无效，已跳过。' });
    return null;
  }
  const src = ro as Record<string, unknown>;
  const idiomA = typeof src.idiomA === 'string' ? src.idiomA.trim() : '';
  const idiomB = typeof src.idiomB === 'string' ? src.idiomB.trim() : '';
  if (!idiomA || !idiomB) {
    issues.push({ stage: 'relationship', severity: 'skipped', message: '关系数据缺少成语字段，已跳过。' });
    return null;
  }
  if (!src.kinship || typeof src.kinship !== 'object') {
    issues.push({ stage: 'relationship', severity: 'skipped', message: `《${idiomA}》-《${idiomB}》关系数据无效，已跳过。` });
    return null;
  }
  return {
    idiomA,
    idiomB,
    kinship: src.kinship as KinshipResult,
    computedAt: typeof src.computedAt === 'string' ? src.computedAt : new Date(0).toISOString()
  };
}

/* ------------------------------------------------------------------ */
/* 损坏抢救：从截断/损坏的原始文本中提取完整条目对象                     */
/* ------------------------------------------------------------------ */

/** 从 raw 中定位 `"key" : [` 并提取其中括号配平的顶层 `{...}` 对象 */
function extractBalancedObjects(raw: string, key: string): unknown[] {
  const objs: unknown[] = [];
  const keyRe = new RegExp(`"${key}"\\s*:\\s*\\[`);
  const m = keyRe.exec(raw);
  if (!m) return objs;
  let i = m.index + m[0].length;
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = raw.slice(start, i + 1);
        try {
          objs.push(JSON.parse(slice));
        } catch {
          /* 单个对象也损坏，跳过 */
        }
        start = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }
  return objs;
}

function salvageFromRaw(raw: string, issues: CorruptionIssue[]): OfflinePackage | null {
  const entryObjs = extractBalancedObjects(raw, 'entries');
  const relObjs = extractBalancedObjects(raw, 'relationships');
  if (entryObjs.length === 0) return null;

  const entries: PackagedEntry[] = [];
  for (const eo of entryObjs) {
    const e = validateEntry(eo, issues);
    if (e) entries.push(e);
  }
  const relationships: PackagedRelationship[] = [];
  for (const ro of relObjs) {
    const r = validateRelationship(ro, issues);
    if (r) relationships.push(r);
  }
  if (entries.length === 0) return null;

  issues.push({
    stage: 'parse',
    severity: 'recovered',
    message: `从损坏文件中抢救回 ${entries.length} 个词条与 ${relationships.length} 条关系数据。`
  });

  const manifest: OfflinePackage['manifest'] = {
    format: PACKAGE_FORMAT,
    formatVersion: PACKAGE_FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    generator: 'zqq-015-recovered',
    entryCount: entries.length,
    relationshipCount: relationships.length
  };
  return { manifest, entries, relationships, checksum: computeChecksum(manifest, entries, relationships) };
}

/* ------------------------------------------------------------------ */
/* 解析 + 校验（含损坏恢复）                                            */
/* ------------------------------------------------------------------ */

export interface ParseOutcome {
  pkg: OfflinePackage | null;
  issues: CorruptionIssue[];
  fatal: boolean;
  checksumValid: boolean;
}

export function parseAndVerify(raw: string): ParseOutcome {
  const issues: CorruptionIssue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    issues.push({ stage: 'parse', severity: 'fatal', message: 'JSON 解析失败，文件可能已损坏或被截断。' });
    const salvaged = salvageFromRaw(raw, issues);
    return { pkg: salvaged, issues, fatal: !salvaged, checksumValid: false };
  }

  if (!parsed || typeof parsed !== 'object') {
    issues.push({ stage: 'parse', severity: 'fatal', message: '文件不是有效的离线包结构。' });
    return { pkg: null, issues, fatal: true, checksumValid: false };
  }
  const root = parsed as Record<string, unknown>;

  // 清单
  let manifest: OfflinePackage['manifest'];
  if (root.manifest && typeof root.manifest === 'object') {
    manifest = root.manifest as OfflinePackage['manifest'];
  } else {
    issues.push({ stage: 'manifest', severity: 'recovered', message: '缺少清单信息，已根据内容重建。' });
    manifest = {
      format: PACKAGE_FORMAT,
      formatVersion: PACKAGE_FORMAT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      generator: 'zqq-015-recovered',
      entryCount: 0,
      relationshipCount: 0
    };
  }

  if (manifest.format && manifest.format !== PACKAGE_FORMAT) {
    issues.push({ stage: 'manifest', severity: 'fatal', message: `无法识别的包格式：${manifest.format}` });
    return { pkg: null, issues, fatal: true, checksumValid: false };
  }

  const versionIssues = checkVersion(manifest.formatVersion);
  issues.push(...versionIssues);
  if (versionIssues.some(i => i.severity === 'fatal')) {
    return { pkg: null, issues, fatal: true, checksumValid: false };
  }

  // 词条
  if (!Array.isArray(root.entries)) {
    issues.push({ stage: 'entry', severity: 'recovered', message: '词条列表缺失或非数组，已尝试从文件中提取。' });
  }
  const rawEntries = Array.isArray(root.entries) ? root.entries : extractBalancedObjects(raw, 'entries');
  const entries: PackagedEntry[] = [];
  for (const eo of rawEntries) {
    const e = validateEntry(eo, issues);
    if (e) entries.push(e);
  }

  // 关系
  const rawRels = Array.isArray(root.relationships) ? root.relationships : extractBalancedObjects(raw, 'relationships');
  const relationships: PackagedRelationship[] = [];
  for (const ro of rawRels) {
    const r = validateRelationship(ro, issues);
    if (r) relationships.push(r);
  }

  // 校验和
  const expected = typeof root.checksum === 'string' ? root.checksum : '';
  const actual = computeChecksum(manifest, entries, relationships);
  const checksumValid = expected === actual;
  if (!checksumValid) {
    issues.push({
      stage: 'checksum',
      severity: 'recovered',
      message: '校验和不匹配：文件可能被篡改或部分损坏，已基于内容重建校验和并抢救数据。'
    });
  }

  // 条目级哈希复核
  for (const e of entries) {
    const recomputed = hashProfile(e.profile);
    if (e.contentHash && e.contentHash !== recomputed) {
      issues.push({ idiom: e.idiom, stage: 'checksum', severity: 'recovered', message: `词条《${e.idiom}》内容哈希不匹配，已按当前内容重建。` });
      e.contentHash = recomputed;
    }
  }

  manifest.entryCount = entries.length;
  manifest.relationshipCount = relationships.length;

  const pkg: OfflinePackage = { manifest, entries, relationships, checksum: checksumValid ? expected : actual };
  return { pkg, issues, fatal: false, checksumValid };
}

/* ------------------------------------------------------------------ */
/* 冲突合并                                                             */
/* ------------------------------------------------------------------ */

/** 字段级智能合并：本地（existing）优先，离线包补全缺口 */
function mergeProfiles(existing: IdiomProfile, incoming: IdiomProfile): IdiomProfile {
  const merged: IdiomProfile = { ...existing };

  const charMap = new Map<string, OracleChar>();
  for (const c of existing.characters) charMap.set(c.char, c);
  for (const c of incoming.characters) if (!charMap.has(c.char)) charMap.set(c.char, c);
  merged.characters = [...charMap.values()].slice(0, 4);

  merged.allusion =
    existing.allusion && existing.allusion.classicBook ? existing.allusion : incoming.allusion;

  const eraMap = new Map<string, SemanticEvolutionStep>();
  for (const s of existing.evolutionPath) eraMap.set(s.era, s);
  for (const s of incoming.evolutionPath) if (!eraMap.has(s.era)) eraMap.set(s.era, s);
  merged.evolutionPath = [...eraMap.values()];

  merged.dna = existing.dna;
  merged.pinyin = existing.pinyin || incoming.pinyin;
  merged.modernDefinition = existing.modernDefinition || incoming.modernDefinition;
  merged.syntacticRole = existing.syntacticRole || incoming.syntacticRole;
  return merged;
}

function resolveConflict(
  existing: IdiomProfile,
  incoming: IdiomProfile,
  strategy: ConflictStrategy,
  store: OfflineStore
): { resolution: EntryConflict['resolution']; imported: boolean; detail: string } {
  if (strategy === 'skip-duplicates') {
    return { resolution: 'skipped', imported: false, detail: '本地已存在同名词条，按策略跳过导入。' };
  }
  if (strategy === 'overwrite') {
    store.entries.set(incoming.idiom, incoming);
    return { resolution: 'overwritten', imported: true, detail: '已用离线包中的版本覆盖本地版本。' };
  }
  // smart-merge
  const merged = mergeProfiles(existing, incoming);
  store.entries.set(merged.idiom, merged);
  return { resolution: 'merged', imported: true, detail: '已按字段智能合并：冲突字段以本地为准，缺失字段由离线包补全。' };
}

/** 导入并合并到离线存储，返回导入报告 */
export function importAndMerge(
  raw: string,
  store: OfflineStore,
  strategy: ConflictStrategy,
  fileName?: string
): { report: ImportReport } {
  const { pkg, issues, fatal, checksumValid } = parseAndVerify(raw);

  const report: ImportReport = {
    success: false,
    fileName,
    formatVersion: pkg?.manifest.formatVersion ?? '未知',
    appVersion: pkg?.manifest.appVersion ?? '未知',
    exportedAt: pkg?.manifest.exportedAt ?? '',
    checksumValid,
    totalEntries: pkg?.entries.length ?? 0,
    importedEntries: 0,
    recoveredEntries: issues.filter(i => i.severity === 'recovered').length,
    skippedEntries: 0,
    totalRelationships: pkg?.relationships.length ?? 0,
    importedRelationships: 0,
    duplicateRelationships: 0,
    conflicts: [],
    issues,
    errors: [],
    strategy
  };

  if (fatal || !pkg) {
    report.errors.push(...issues.filter(i => i.severity === 'fatal').map(i => i.message));
    return { report };
  }

  // 合并词条
  for (const entry of pkg.entries) {
    const existing = store.entries.get(entry.idiom);
    if (!existing) {
      store.entries.set(entry.idiom, entry.profile);
      report.importedEntries++;
    } else {
      const resolution = resolveConflict(existing, entry.profile, strategy, store);
      report.conflicts.push({
        idiom: entry.idiom,
        reason: hashProfile(existing) === hashProfile(entry.profile) ? 'duplicate' : 'content-differs',
        resolution: resolution.resolution,
        detail: resolution.detail
      });
      if (resolution.imported) report.importedEntries++;
      else report.skippedEntries++;
    }
  }

  // 合并关系（按无序对去重）
  for (const rel of pkg.relationships) {
    const key = relKey(rel.idiomA, rel.idiomB);
    if (store.relationshipKeys.has(key)) {
      report.duplicateRelationships++;
      continue;
    }
    store.relationships.push(rel);
    store.relationshipKeys.add(key);
    report.importedRelationships++;
  }

  report.success = true;
  return { report };
}
