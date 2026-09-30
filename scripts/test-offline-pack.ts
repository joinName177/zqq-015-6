/**
 * 离线资料包核心逻辑自测：版本校验 / 冲突合并 / 损坏恢复 / 校验和。
 * 运行：npx tsx scripts/test-offline-pack.ts （或 node --experimental-strip-types）
 */
import {
  createPack,
  inspectPack,
  salvagePack,
  isInspectFatal,
  checkVersion,
  CURRENT_PACK_VERSION,
  ProfileEntry,
  RelationEntry,
  buildPackChecksum,
  classifyEntry,
  resolveEntry,
  mergeRelations,
  relationKeyOf,
  upgradeEntry
} from '../src/core/offline-pack';
import { generateGenericIdiom } from '../src/core/etymology-engine';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function makeEntry(idiom: string, revision: number, updatedAt: string, tweak = 0): ProfileEntry {
  const profile = generateGenericIdiom(idiom);
  if (tweak > 0) {
    profile.dna = { ...profile.dna, metaphoricalPercent: profile.dna.metaphoricalPercent - tweak };
    profile.modernDefinition = `${profile.modernDefinition}#${tweak}`;
  }
  return { profile, revision, source: 'online', updatedAt };
}

function makeRelation(a: string, b: string): RelationEntry {
  return {
    key: relationKeyOf(a, b),
    keyA: a,
    keyB: b,
    result: {
      idiomA: makeEntry(a, 1, '2026-01-01T00:00:00.000Z').profile,
      idiomB: makeEntry(b, 1, '2026-01-01T00:00:00.000Z').profile,
      kinshipScore: 50,
      dnaVectorSimilarity: 60,
      sharedSememes: [],
      polarityCompatibility: true,
      relationshipLabel: '形似神离',
      comparativeAnalysis: '测试关系'
    },
    revision: 1,
    updatedAt: '2026-01-02T00:00:00.000Z'
  };
}

console.log('\n[1] 版本校验');
assert(checkVersion(CURRENT_PACK_VERSION).status === 'compatible', '当前版本兼容');
assert(checkVersion(CURRENT_PACK_VERSION - 1).status === 'upgradable', '旧版本可升级');
assert(checkVersion(CURRENT_PACK_VERSION + 1).status === 'incompatible', '未来版本拒绝导入');
assert(checkVersion(0).status === 'incompatible', '无效版本号拒绝');

console.log('\n[2] 打包与校验和');
const e1 = makeEntry('守株待兔', 1, '2026-01-01T00:00:00.000Z');
const e2 = makeEntry('刻舟求剑', 1, '2026-01-01T00:00:00.000Z');
const r1 = makeRelation('守株待兔', '刻舟求剑');
const pack = createPack([e1, e2], [r1], { createdBy: 'test' });
assert(pack.manifest.entryCount === 2, '清单记录 2 词条');
assert(pack.manifest.relationCount === 1, '清单记录 1 关系');
assert(pack.checksum === buildPackChecksum(pack.entries, pack.relations), '校验和与内容一致');
assert(pack.manifest.formatVersion === CURRENT_PACK_VERSION, '使用当前格式版本');

// 重复词条去重
const packDedup = createPack([e1, e1], []);
assert(packDedup.manifest.entryCount === 1, '包内重复词条自动去重');

console.log('\n[3] 冲突判定与合并策略');
const e1Local: ProfileEntry = JSON.parse(JSON.stringify(e1));
assert(classifyEntry(e1, e1Local) === 'identical', '完全相同条目判定 identical');
const e1Newer = makeEntry('守株待兔', 2, '2026-02-01T00:00:00.000Z', 5);
assert(classifyEntry(e1Newer, e1Local) === 'conflict', '修订不同判定 conflict');
assert(classifyEntry(e1, null) === 'new', '本地无记录判定 new');
assert(resolveEntry(e1Newer, e1Local, 'skip') === e1Local, 'skip 策略保留本地');
assert(resolveEntry(e1Newer, e1Local, 'overwrite') === e1Newer, 'overwrite 策略使用包内');
const older = makeEntry('守株待兔', 2, '2025-12-01T00:00:00.000Z', 3);
assert(resolveEntry(older, e1Local, 'newer-wins') === e1Local, 'newer-wins 本地更新时保留本地');
assert(resolveEntry(e1Newer, e1Local, 'newer-wins') === e1Newer, 'newer-wins 包内更新时采用包内');

console.log('\n[4] 一体化预检与落库合并（模拟）');
const locals = [e1Local];
const inspection = inspectPack(JSON.stringify(pack), locals, { strategy: 'newer-wins' });
if (isInspectFatal(inspection)) {
  assert(false, `预检不应致命失败: ${inspection.fatal}`);
} else {
  assert(inspection.version.status === 'compatible', '预检版本兼容');
  assert(inspection.plan.length === 2, '预检计划含 2 词条');
  assert(inspection.plan.find(p => p.key === '守株待兔')!.conflict === 'identical', '已存在相同词条标 identical');
  assert(inspection.plan.find(p => p.key === '刻舟求剑')!.conflict === 'new', '新词条标 new');
  assert(inspection.report.relationsApplied === 1, '关系预演应用 1 条');
  assert(inspection.report.warnings.length === 0, '完好包无警告');
}

console.log('\n[5] 校验和篡改检测');
const tampered = JSON.parse(JSON.stringify(pack));
tampered.entries[0].profile.modernDefinition = '被篡改的释义';
const inspTampered = inspectPack(JSON.stringify(tampered), [], { strategy: 'newer-wins' });
if (!isInspectFatal(inspTampered)) {
  assert(inspTampered.report.warnings.some(w => w.includes('校验和')), '篡改后报告校验和警告');
}

console.log('\n[6] 损坏恢复：截断 + 单条目损坏');
const goodText = JSON.stringify(pack);
// 6a. 从中间截断
const truncated = goodText.slice(0, Math.floor(goodText.length * 0.6));
const salTrunc = salvagePack(truncated);
assert(salTrunc.pack !== null, '截断文件仍能抢救出包');
assert(salTrunc.salvaged === true, '标记为经过抢救');
assert((salTrunc.pack?.entries.length ?? 0) >= 1, '至少恢复 1 个词条');
console.log(`      截断恢复: ${salTrunc.pack?.entries.length} 词条 / ${salTrunc.pack?.relations.length} 关系`);

// 6b. 单条目内部损坏（JSON 片段坏），其余完好
const corruptedText = goodText.replace('"originalPercent"', '"BROKEN_FIELD!!"');
const salCorrupt = salvagePack(corruptedText);
assert(salCorrupt.pack !== null, '损坏文件可抢救');
assert(salCorrupt.droppedItems >= 1, '至少丢弃 1 个损坏条目');
console.log(`      损坏剔除: 丢弃 ${salCorrupt.droppedItems}，恢复 ${salTrunc.pack?.entries.length ?? 0} 词条`);

// 6c. 完全垃圾
const salGarbage = salvagePack('<<<not json at all>>>');
assert(salGarbage.pack === null, '完全无法识别时返回 null');

console.log('\n[7] 关系合并：缺词条 / 修订更旧时跳过');
const mergedRel = mergeRelations([r1], [], new Set(['守株待兔']));
assert(mergedRel.applied === 0 && mergedRel.skipped === 1, '缺少引用词条时跳过关系');
const newerRel: RelationEntry = { ...r1, revision: 9 };
const mergedRel2 = mergeRelations([r1], [newerRel], new Set(['守株待兔', '刻舟求剑']));
assert(mergedRel2.applied === 0, '本地关系修订更新时保留本地');

console.log('\n[8] 旧版本迁移 v1 -> v2');
const legacy = makeEntry('卧薪尝胆', 0, '');
const migrated = upgradeEntry(legacy, 1);
assert(migrated.revision >= 1, '迁移后修订号补齐');
assert(typeof migrated.updatedAt === 'string' && migrated.updatedAt.length > 0, '迁移后时间戳补齐');
assert(migrated.profile.id.length > 0, '迁移后 id 补齐');

console.log(`\n结果: ${passed} 通过 / ${failed} 失败`);
if (failed > 0) process.exit(1);
