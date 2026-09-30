import { IdiomProfile, KinshipResult } from './models';

/* =========================================================================
 * 离线资料包（Offline Pack）核心领域逻辑
 *
 * 设计原则：
 *  - 本模块为纯函数核心层，不依赖 DOM / IndexedDB / localStorage，
 *    可在浏览器、Node 与测试环境中直接运行。
 *  - 离线与在线共享同一领域模型（IdiomProfile / KinshipResult），
 *    离线包只是这些模型的可移植、可校验、可修复的序列化载体。
 * ========================================================================= */

/** 当前离线包格式版本；不兼容的旧版本将被拒绝导入 */
export const CURRENT_PACK_VERSION = 2;
/** 可被本系统接受的最低格式版本（低于此版本需另行迁移，无法直接导入） */
export const MIN_SUPPORTED_PACK_VERSION = 1;
/** 离线包魔数，用于快速识别文件类型 */
export const PACK_MAGIC = 'ZQQ15-OFFLINE-PACK';

export type MergeStrategy = 'skip' | 'overwrite' | 'newer-wins';
export type PackSource = 'online' | 'local-generated';
export type EntryConflictStatus = 'new' | 'identical' | 'conflict';
export type VersionStatus = 'compatible' | 'upgradable' | 'incompatible';

/** 词条条目：在共享模型 IdiomProfile 之外附加包内溯源元数据 */
export interface ProfileEntry {
  profile: IdiomProfile;
  /** 词条修订版本，每次内容更新递增，用于版本校验与冲突判定 */
  revision: number;
  /** 数据来源：在线典籍 / 本地推演生成 */
  source: PackSource;
  /** ISO 时间戳：该条目最近一次内容修订时间 */
  updatedAt: string;
}

/** 关系条目：仅存储关系数据，被比较的两个词条由其 key 引用 */
export interface RelationEntry {
  key: string;
  keyA: string;
  keyB: string;
  result: KinshipResult;
  revision: number;
  updatedAt: string;
}

export interface PackManifest {
  magic: string;
  formatVersion: number;
  createdAt: string;
  createdBy: string;
  description: string;
  entryCount: number;
  relationCount: number;
}

export interface OfflinePack {
  manifest: PackManifest;
  entries: ProfileEntry[];
  relations: RelationEntry[];
  /** 对 entries + relations 序列化字节的校验和（FNV-1a 十六进制） */
  checksum: string;
}

export interface LocalStoreStatus {
  formatVersion: number;
  entryCount: number;
  relationCount: number;
  rebuiltAt: string | null;
}

export interface VersionCheckResult {
  status: VersionStatus;
  formatVersion: number;
  reason: string;
}

export interface ImportPlanEntry {
  key: string;
  idiom: string;
  incoming: ProfileEntry;
  local: ProfileEntry | null;
  conflict: EntryConflictStatus;
  strategy: MergeStrategy;
}

export interface ImportReport {
  accepted: number;
  skipped: number;
  overwritten: number;
  relationsApplied: number;
  relationsSkipped: number;
  recoveredEntries: number;
  recoveredRelations: number;
  warnings: string[];
}

export interface InspectedPack {
  manifest: PackManifest;
  checksum: string;
  version: VersionCheckResult;
  plan: ImportPlanEntry[];
  /** 通过校验/恢复的关系数据（确认导入时使用） */
  relations: RelationEntry[];
  report: ImportReport;
  /** 原始字节因截断/损坏而被抢救恢复时为 true */
  salvaged: boolean;
}

/* -------------------------------------------------------------------------
 * 通用工具
 * ------------------------------------------------------------------------- */

/** 词条唯一键：与在线查询归一化规则保持一致（trim + 最多四字） */
export function normalizeKey(idiomText: string): string {
  return idiomText.trim().slice(0, 4);
}

export function relationKeyOf(keyA: string, keyB: string): string {
  return [keyA, keyB].sort().join('::');
}

/** FNV-1a 32bit 校验和：纯字符串实现，无需 crypto / Buffer，浏览器与 Node 通用 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // 无符号右移保证非负，再补齐 8 位十六进制
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** 关系负载哈希：关系与具体词条内容绑定，词条修订后旧关系失效 */
export function fingerprintRelation(r: { keyA: string; keyB: string; result: KinshipResult }): string {
  const { comparativeAnalysis, kinshipScore, dnaVectorSimilarity, relationshipLabel } = r.result;
  return fnv1a(
    JSON.stringify([r.keyA, r.keyB, kinshipScore, dnaVectorSimilarity, relationshipLabel, comparativeAnalysis])
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------
 * 版本校验
 * ------------------------------------------------------------------------- */

export function checkVersion(formatVersion: number): VersionCheckResult {
  if (typeof formatVersion !== 'number' || Number.isNaN(formatVersion) || formatVersion <= 0) {
    return { status: 'incompatible', formatVersion: Number(formatVersion) || 0, reason: '缺少有效的格式版本号，无法识别此离线包。' };
  }
  if (formatVersion < MIN_SUPPORTED_PACK_VERSION) {
    return {
      status: 'incompatible',
      formatVersion,
      reason: `离线包格式版本 v${formatVersion} 已过期，最低支持 v${MIN_SUPPORTED_PACK_VERSION}，请重新下载资料包。`
    };
  }
  if (formatVersion > CURRENT_PACK_VERSION) {
    return {
      status: 'incompatible',
      formatVersion,
      reason: `离线包来自更新版本的系统（v${formatVersion}），当前系统为 v${CURRENT_PACK_VERSION}，请升级后再导入。`
    };
  }
  if (formatVersion < CURRENT_PACK_VERSION) {
    return {
      status: 'upgradable',
      formatVersion,
      reason: `离线包为旧格式 v${formatVersion}，导入时将自动迁移至 v${CURRENT_PACK_VERSION}。`
    };
  }
  return { status: 'compatible', formatVersion, reason: `格式版本 v${formatVersion}，与当前系统兼容。` };
}

/* -------------------------------------------------------------------------
 * 旧版本条目迁移（upgradable 版本在导入时调用）
 * ------------------------------------------------------------------------- */

/** 升级注册表：v1 -> v2 -> ... 逐级升级 */
const entryMigrators: Array<(entry: ProfileEntry) => ProfileEntry> = [
  // v1 -> v2：v1 的通用生成条目缺少 id 稳定性，补齐 source/updatedAt 元数据
  (entry: ProfileEntry) => ({
    ...entry,
    revision: Math.max(1, entry.revision || 1),
    source: entry.source ?? 'local-generated',
    updatedAt: entry.updatedAt ? entry.updatedAt : nowIso(),
    profile: { ...entry.profile, id: entry.profile.id || `id-migrated-${fnv1a(entry.profile.idiom).slice(0, 8)}` }
  })
];

export function upgradeEntry(entry: ProfileEntry, fromVersion: number): ProfileEntry {
  let upgraded = entry;
  for (let v = fromVersion; v < CURRENT_PACK_VERSION; v++) {
    const migrator = entryMigrators[v - 1];
    if (migrator) upgraded = migrator(upgraded);
  }
  return upgraded;
}

/* -------------------------------------------------------------------------
 * 条目结构校验（损坏恢复的最小可用判定）
 * ------------------------------------------------------------------------- */

export function isValidProfileEntry(value: unknown): value is ProfileEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<ProfileEntry>;
  const p = e.profile as Partial<IdiomProfile> | undefined;
  if (!p || typeof p.idiom !== 'string' || !p.idiom.trim()) return false;
  if (!Array.isArray(p.characters) || p.characters.length === 0) return false;
  if (!p.allusion || typeof p.allusion !== 'object') return false;
  if (!Array.isArray(p.evolutionPath) || p.evolutionPath.length === 0) return false;
  const dna = p.dna as IdiomProfile['dna'] | undefined;
  if (!dna || typeof dna.originalPercent !== 'number' || typeof dna.extendedPercent !== 'number' ||
      typeof dna.metaphoricalPercent !== 'number' || !Array.isArray(dna.coreSememes)) {
    return false;
  }
  return typeof e.revision === 'number' && typeof e.updatedAt === 'string';
}

export function isValidRelationEntry(value: unknown): value is RelationEntry {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<RelationEntry>;
  if (typeof r.key !== 'string' || typeof r.keyA !== 'string' || typeof r.keyB !== 'string') return false;
  const res = r.result as Partial<KinshipResult> | undefined;
  if (!res || typeof res.kinshipScore !== 'number' || !res.idiomA || !res.idiomB) return false;
  return typeof r.revision === 'number' && typeof r.updatedAt === 'string';
}

/* -------------------------------------------------------------------------
 * 打包
 * ------------------------------------------------------------------------- */

export function buildPackChecksum(entries: ProfileEntry[], relations: RelationEntry[]): string {
  return fnv1a(stableStringify({ entries, relations }));
}

export function createPack(
  selected: ProfileEntry[],
  relations: RelationEntry[],
  meta: { createdBy?: string; description?: string } = {}
): OfflinePack {
  const keySeen = new Set<string>();
  const entries = selected
    .filter(e => isValidProfileEntry(e))
    .filter(e => {
      const key = normalizeKey(e.profile.idiom);
      if (keySeen.has(key)) return false;
      keySeen.add(key);
      return true;
    });

  const validRelations = relations.filter(r => isValidRelationEntry(r));
  const createdAt = nowIso();
  const pack: OfflinePack = {
    manifest: {
      magic: PACK_MAGIC,
      formatVersion: CURRENT_PACK_VERSION,
      createdAt,
      createdBy: meta.createdBy || 'zqq-015',
      description: meta.description || `离线资料包 · ${entries.length} 词条 / ${validRelations.length} 关系`,
      entryCount: entries.length,
      relationCount: validRelations.length
    },
    entries,
    relations: validRelations,
    checksum: ''
  };
  pack.checksum = buildPackChecksum(pack.entries, pack.relations);
  return pack;
}

/* -------------------------------------------------------------------------
 * 冲突判定
 * ------------------------------------------------------------------------- */

/** 冲突状态：new（本地无）/ identical（完全一致）/ conflict（修订不同） */
export function classifyEntry(incoming: ProfileEntry, local: ProfileEntry | null): EntryConflictStatus {
  if (!local) return 'new';
  if (
    local.revision === incoming.revision &&
    local.updatedAt === incoming.updatedAt &&
    stableStringify(local.profile) === stableStringify(incoming.profile)
  ) {
    return 'identical';
  }
  return 'conflict';
}

/** 对单个冲突条目应用合并策略，返回最终应落库的条目（null 表示跳过） */
export function resolveEntry(
  incoming: ProfileEntry,
  local: ProfileEntry | null,
  strategy: MergeStrategy
): ProfileEntry | null {
  const status = classifyEntry(incoming, local);
  if (status === 'new') return incoming;
  if (status === 'identical') {
    return strategy === 'skip' ? local : incoming;
  }
  switch (strategy) {
    case 'skip':
      return local;
    case 'overwrite':
      return incoming;
    case 'newer-wins': {
      if (!local) return incoming;
      const tIn = Date.parse(incoming.updatedAt) || 0;
      const tLocal = Date.parse(local.updatedAt) || 0;
      return tIn > tLocal ? incoming : local;
    }
  }
}

/* -------------------------------------------------------------------------
 * 导入事务规划（不落库，纯计算；由适配器按计划写入 IndexedDB）
 * ------------------------------------------------------------------------- */

export interface BuildPlanOptions {
  strategy: MergeStrategy;
  /** 逐条覆盖默认策略：key -> strategy */
  overrides?: Record<string, MergeStrategy>;
}

export function buildImportPlan(
  entries: ProfileEntry[],
  locals: ProfileEntry[],
  opts: BuildPlanOptions
): ImportPlanEntry[] {
  const localByKey = new Map(locals.map(e => [normalizeKey(e.profile.idiom), e]));
  const plan: ImportPlanEntry[] = [];
  const seen = new Set<string>();

  for (const rawIncoming of entries) {
    const key = normalizeKey(rawIncoming.profile.idiom);
    if (seen.has(key)) continue; // 包内重复词条取首个
    seen.add(key);
    const local = localByKey.get(key) ?? null;
    plan.push({
      key,
      idiom: rawIncoming.profile.idiom,
      incoming: rawIncoming,
      local,
      conflict: classifyEntry(rawIncoming, local),
      strategy: opts.overrides?.[key] ?? opts.strategy
    });
  }
  return plan;
}

/** 按计划执行内存中的合并，返回最终条目集合与导入报告 */
export function mergeEntries(
  plan: ImportPlanEntry[],
  locals: ProfileEntry[]
): { merged: ProfileEntry[]; report: Pick<ImportReport, 'accepted' | 'skipped' | 'overwritten'> } {
  const byKey = new Map(locals.map(e => [normalizeKey(e.profile.idiom), e]));
  let accepted = 0;
  let skipped = 0;
  let overwritten = 0;

  for (const item of plan) {
    const resolved = resolveEntry(item.incoming, item.local, item.strategy);
    if (resolved === null) {
      skipped++;
      continue;
    }
    const existed = byKey.has(item.key);
    if (item.conflict === 'identical' && resolved === item.local && item.strategy === 'skip') {
      skipped++;
      continue;
    }
    if (!existed || item.conflict === 'new') accepted++;
    else overwritten++;
    byKey.set(item.key, resolved);
  }

  return {
    merged: [...byKey.values()],
    report: { accepted, skipped, overwritten }
  };
}

/**
 * 合并关系：仅当关系所引用的两个词条在合并后集合中存在，
 * 且本地没有更新修订的同键关系时才应用。
 */
export function mergeRelations(
  incoming: RelationEntry[],
  existing: RelationEntry[],
  availableKeys: Set<string>
): { relations: RelationEntry[]; applied: number; skipped: number; warnings: string[] } {
  const byKey = new Map(existing.map(r => [r.key, r]));
  let applied = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const rel of incoming) {
    if (!availableKeys.has(rel.keyA) || !availableKeys.has(rel.keyB)) {
      skipped++;
      warnings.push(`关系「${rel.keyA} ↔ ${rel.keyB}」缺少对应词条数据，已跳过。`);
      continue;
    }
    const local = byKey.get(rel.key);
    if (local && local.revision > rel.revision) {
      skipped++;
      warnings.push(`关系「${rel.keyA} ↔ ${rel.keyB}」本地修订更新（r${local.revision}），已保留本地版本。`);
      continue;
    }
    if (!byKey.has(rel.key)) applied++;
    byKey.set(rel.key, rel);
  }

  return { relations: [...byKey.values()], applied, skipped, warnings };
}

/* -------------------------------------------------------------------------
 * 损坏恢复：对被截断 / 污染的包文本做抢救式解析
 * ------------------------------------------------------------------------- */

/**
 * 从 JSON 文本中按平衡括号扫描提取指定键的数组片段。
 * 正确处理字符串内的转义与括号，避免被内容中的 "}," 干扰。
 */
function extractArrayFragment(text: string, prop: string): string | null {
  const propAt = text.indexOf(`"${prop}"`);
  if (propAt < 0) return null;
  const start = text.indexOf('[', propAt);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0 && ch === ']') return text.slice(start, i + 1);
      if (depth < 0) {
        // 闭合残缺：退回到最后一个完整对象边界后补齐括号
        const lastBrace = text.lastIndexOf('}', i);
        if (lastBrace > start) return `${text.slice(start, lastBrace + 1)}]`;
        return null;
      }
    }
  }
  // 文本被截断：用最后一个完整对象收尾
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace > start) return `${text.slice(start, lastBrace + 1)}]`;
  return null;
}

/** 扫描数组文本，逐个切分顶层对象并尝试 JSON.parse（跳过损坏的单个对象） */
function parseObjectsSalvage<T>(arrayText: string, validate: (v: unknown) => v is T): { items: T[]; recovered: number } {
  const items: T[] = [];
  let recovered = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;

  for (let i = 0; i < arrayText.length; i++) {
    const ch = arrayText[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const fragment = arrayText.slice(objStart, i + 1);
        try {
          const parsed: unknown = JSON.parse(fragment);
          if (validate(parsed)) items.push(parsed);
          else recovered++; // 结构不完整
        } catch {
          recovered++; // 单条目损坏被丢弃，其余继续抢救
        }
        objStart = -1;
      }
    }
  }
  return { items, recovered };
}

export interface SalvageResult {
  pack: OfflinePack | null;
  /** 抢救后幸存的词条 / 关系数量（正常解析时为 0） */
  recoveredEntries: number;
  recoveredRelations: number;
  /** 因结构损坏被丢弃的条目总数 */
  droppedItems: number;
  /** 文件发生过截断/损坏（经过抢救流程） */
  salvaged: boolean;
  warnings: string[];
}

/**
 * 损坏恢复入口：
 * 1. 先尝试整体 JSON.parse + 校验和验证；
 * 2. 失败则按 entries / relations 片段逐对象抢救；
 * 3. 校验和不匹配但结构完整时，仍可导入但给出警告。
 */
export function salvagePack(rawText: string): SalvageResult {
  const warnings: string[] = [];

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Partial<OfflinePack>;
    if (Array.isArray(p.entries) && Array.isArray(p.relations)) {
      const validEntries = (p.entries as unknown[]).filter(isValidProfileEntry) as ProfileEntry[];
      const validRelations = (p.relations as unknown[]).filter(isValidRelationEntry) as RelationEntry[];
      const dropped = p.entries.length + p.relations.length - validEntries.length - validRelations.length;
      if (dropped > 0) warnings.push(`包内 ${dropped} 个条目结构损坏，已在恢复中剔除。`);
      return finalizeSalvage(p, validEntries, validRelations, dropped, warnings, dropped > 0);
    }
  }

  // 整体解析失败：片段抢救
  const entryFrag = extractArrayFragment(rawText, 'entries');
  const relationFrag = extractArrayFragment(rawText, 'relations');
  const entries = entryFrag ? parseObjectsSalvage(entryFrag, isValidProfileEntry) : { items: [], recovered: 0 };
  const relations = relationFrag ? parseObjectsSalvage(relationFrag, isValidRelationEntry) : { items: [], recovered: 0 };

  if (entries.items.length === 0 && relations.items.length === 0) {
    return {
      pack: null,
      recoveredEntries: 0,
      recoveredRelations: 0,
      droppedItems: entries.recovered + relations.recovered,
      salvaged: false,
      warnings: ['文件严重损坏，未能恢复任何词条或关系数据。']
    };
  }

  warnings.push(
    `离线包文件已损坏（JSON 结构不完整），已启动抢救恢复：成功恢复 ${entries.items.length} 个词条、` +
      `${relations.items.length} 个关系；${entries.recovered + relations.recovered} 个损坏片段被丢弃。`
  );

  const manifestHint = extractManifestHint(rawText);
  const partial: Partial<OfflinePack> = { manifest: manifestHint ?? undefined, checksum: '' };
  const result = finalizeSalvage(partial, entries.items, relations.items, 0, warnings, true);
  result.recoveredEntries = entries.items.length;
  result.recoveredRelations = relations.items.length;
  result.droppedItems = entries.recovered + relations.recovered;
  return result;
}

function extractManifestHint(rawText: string): PackManifest | null {
  const frag = extractObjectFragment(rawText, 'manifest');
  if (!frag) return null;
  try {
    const m = JSON.parse(frag) as Partial<PackManifest>;
    if (typeof m.formatVersion === 'number') return m as PackManifest;
  } catch {
    /* ignore */
  }
  return null;
}

function extractObjectFragment(text: string, prop: string): string | null {
  const propAt = text.indexOf(`"${prop}"`);
  if (propAt < 0) return null;
  const start = text.indexOf('{', propAt);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  const end = text.lastIndexOf('}');
  return end > start ? `${text.slice(start, end + 1)}}` : null;
}

function finalizeSalvage(
  p: Partial<OfflinePack>,
  entries: ProfileEntry[],
  relations: RelationEntry[],
  droppedItems: number,
  warnings: string[],
  salvaged: boolean
): SalvageResult {
  const incomingVersion =
    p.manifest && typeof p.manifest.formatVersion === 'number'
      ? p.manifest.formatVersion
      : CURRENT_PACK_VERSION;

  const upgraded = checkVersion(incomingVersion).status === 'upgradable'
    ? entries.map(e => upgradeEntry(e, incomingVersion))
    : entries;

  const manifest: PackManifest = p.manifest ?? {
    magic: PACK_MAGIC,
    formatVersion: CURRENT_PACK_VERSION,
    createdAt: nowIso(),
    createdBy: 'recovered',
    description: '损坏恢复重建的离线包',
    entryCount: upgraded.length,
    relationCount: relations.length
  };
  if (typeof manifest.entryCount !== 'number') manifest.entryCount = upgraded.length;
  if (typeof manifest.relationCount !== 'number') manifest.relationCount = relations.length;

  const pack: OfflinePack = {
    manifest,
    entries: upgraded,
    relations,
    checksum: buildPackChecksum(upgraded, relations)
  };

  if (p.checksum && p.checksum !== pack.checksum) {
    warnings.push('校验和与包内容不一致——资料包可能被篡改或部分损坏，已对通过结构校验的内容执行恢复导入。');
  }
  if (manifest.entryCount !== upgraded.length || manifest.relationCount !== relations.length) {
    warnings.push(
      `清单声明 ${manifest.entryCount} 词条 / ${manifest.relationCount} 关系，实际恢复 ${upgraded.length} / ${relations.length}。`
    );
  }
  if (droppedItems > 0 && !warnings.some(w => w.includes('损坏片段') || w.includes('结构损坏'))) {
    warnings.push(`恢复过程中剔除了 ${droppedItems} 个损坏条目。`);
  }

  return {
    pack,
    recoveredEntries: salvaged ? upgraded.length : 0,
    recoveredRelations: salvaged ? relations.length : 0,
    droppedItems,
    salvaged,
    warnings
  };
}

/* -------------------------------------------------------------------------
 * 一体化导入预检（供 UI 在真正写入前展示版本、冲突、恢复情况）
 * ------------------------------------------------------------------------- */

export type InspectResult = InspectedPack | { fatal: string; salvage: SalvageResult };

export function isInspectFatal(r: InspectResult): r is { fatal: string; salvage: SalvageResult } {
  return typeof (r as { fatal?: unknown }).fatal === 'string';
}

export function inspectPack(
  rawText: string,
  locals: ProfileEntry[],
  opts: BuildPlanOptions
): InspectResult {
  const salvage = salvagePack(rawText);
  if (!salvage.pack) {
    return { fatal: '无法解析离线包文件，且损坏恢复失败。', salvage };
  }
  const pack = salvage.pack;
  const version = checkVersion(pack.manifest.formatVersion);
  if (version.status === 'incompatible') {
    return { fatal: version.reason, salvage };
  }

  const entries =
    version.status === 'upgradable'
      ? pack.entries.map(e => upgradeEntry(e, pack.manifest.formatVersion))
      : pack.entries;

  const plan = buildImportPlan(entries, locals, opts);

  // 校验和：以升级后的内容重算（升级只补元数据，不改变 profile 内容）
  const recomputed = buildPackChecksum(entries, pack.relations);
  const warnings = [...salvage.warnings];
  if (pack.checksum && recomputed !== pack.checksum && !warnings.some(w => w.includes('校验和'))) {
    warnings.push('校验和与包内容不一致，导入可能不完整，请谨慎核对。');
  }
  if (version.status === 'upgradable') warnings.push(version.reason);

  const report = summarizePlan(plan, locals, [], pack.relations);
  report.recoveredEntries = salvage.recoveredEntries;
  report.recoveredRelations = salvage.recoveredRelations;
  report.warnings = [...warnings, ...report.warnings];

  return {
    manifest: pack.manifest,
    checksum: pack.checksum,
    version,
    plan,
    relations: pack.relations,
    report,
    salvaged: salvage.salvaged
  };
}

/** 预检报告：按策略判定每条冲突的处置结果，并预估关系导入情况（不落库） */
export function summarizePlan(
  plan: ImportPlanEntry[],
  locals: ProfileEntry[],
  existingRelations: RelationEntry[],
  incomingRelations: RelationEntry[]
): ImportReport {
  let accepted = 0;
  let skipped = 0;
  let overwritten = 0;
  const finalKeys = new Set(locals.map(e => normalizeKey(e.profile.idiom)));

  for (const item of plan) {
    const resolved = resolveEntry(item.incoming, item.local, item.strategy);
    if (resolved === null) {
      skipped++;
      continue;
    }
    if (item.conflict === 'new') {
      accepted++;
    } else if (item.conflict === 'identical' && resolved === item.local) {
      skipped++;
    } else {
      overwritten++;
    }
    finalKeys.add(item.key);
  }

  const warnings: string[] = [];
  let relationsApplied = 0;
  let relationsSkipped = 0;
  const existingByKey = new Map(existingRelations.map(r => [r.key, r]));
  for (const rel of incomingRelations) {
    if (!finalKeys.has(rel.keyA) || !finalKeys.has(rel.keyB)) {
      relationsSkipped++;
      continue;
    }
    const local = existingByKey.get(rel.key);
    if (local && local.revision > rel.revision) {
      relationsSkipped++;
      continue;
    }
    relationsApplied++;
    existingByKey.set(rel.key, rel);
  }

  return {
    accepted,
    skipped,
    overwritten,
    relationsApplied,
    relationsSkipped,
    recoveredEntries: 0,
    recoveredRelations: 0,
    warnings
  };
}

/** 真正落库：按计划合并词条与关系，返回最终集合与报告（供适配器写入存储） */
export function commitPlan(
  plan: ImportPlanEntry[],
  locals: ProfileEntry[],
  incomingRelations: RelationEntry[],
  existingRelations: RelationEntry[]
): {
  merged: ProfileEntry[];
  relations: RelationEntry[];
  report: ImportReport;
} {
  const { merged, report: entryReport } = mergeEntries(plan, locals);
  const availableKeys = new Set(merged.map(e => normalizeKey(e.profile.idiom)));
  const relResult = mergeRelations(incomingRelations, existingRelations, availableKeys);
  return {
    merged,
    relations: relResult.relations,
    report: {
      ...entryReport,
      relationsApplied: relResult.applied,
      relationsSkipped: relResult.skipped,
      recoveredEntries: 0,
      recoveredRelations: 0,
      warnings: relResult.warnings
    }
  };
}
