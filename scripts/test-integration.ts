/**
 * 适配器层集成自测：IndexedDB 适配器 + 统一资料库（在线/离线同模型）
 * + 离线服务的导出 → 导入（冲突合并）全链路。
 */
import 'fake-indexeddb/auto';
import { IndexedDbOfflineAdapter } from '../src/adapters/indexeddb-offline.adapter';
import { UnifiedIdiomRepository, OfflineMissError } from '../src/adapters/unified-repository.adapter';
import { OfflinePackService, serializePack } from '../src/adapters/offline-pack.service';
import { DictionaryAdapter } from '../src/adapters/dictionary.adapter';
import { KinshipAdapter } from '../src/adapters/kinship.adapter';
import { createPack, ProfileEntry, fnv1a } from '../src/core/offline-pack';

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

async function main() {
  console.log('\n[A] IndexedDB 适配器基础读写');
  const store = new IndexedDbOfflineAdapter();
  const online = new DictionaryAdapter();
  const repo = new UnifiedIdiomRepository(online, store);

  // 首次查询：在线 -> 回写缓存
  const first = await repo.resolveProfile('守株待兔');
  assert(first.origin === 'online', '首次查询走在线适配器');
  const cached = await store.getEntry('守株待兔');
  assert(cached !== null && cached!.revision === 1, '在线结果以同一模型缓存，revision=1');
  assert(cached!.source === 'online', '内置富词条标记为 online');

  // 再次查询：离线命中，模型一致
  const second = await repo.resolveProfile('守株待兔');
  assert(second.origin === 'offline', '第二次查询命中离线库');
  assert(JSON.stringify(second.data) === JSON.stringify(first.data), '离线与在线返回同一模型数据');

  // 通用生成词条：来源标记 + 稳定指纹（不产生新版本）
  await repo.resolveProfile('测试成语');
  const genEntry = await store.getEntry('测试成语');
  assert(genEntry?.source === 'local-generated', '通用推演词条标记 local-generated');
  await store.cacheProfile(genEntry!.profile, 'local-generated');
  const again = await store.getEntry('测试成语');
  assert(again!.revision === 1, '内容未变时重复缓存不递增 revision');

  console.log('\n[B] 仅离线模式');
  repo.setOfflineOnly(true);
  assert((await repo.resolveProfile('守株待兔')).origin === 'offline', '已缓存词条离线可读');
  let threw = false;
  try {
    await repo.resolveProfile('刻舟求剑'); // 尚未缓存
  } catch (e) {
    threw = e instanceof OfflineMissError;
  }
  assert(threw, '离线模式未命中抛出 OfflineMissError');
  repo.setOfflineOnly(false);

  console.log('\n[C] 关系缓存与随包导出');
  const kinship = new KinshipAdapter();
  const { result } = await repo.resolveComparison('守株待兔', '刻舟求剑', (x, y) =>
    kinship.compareIdioms(x, y)
  );
  assert(result.kinshipScore > 0, '亲缘比对产出有效分数');
  const rels = await store.getAllRelations();
  assert(rels.length >= 1, '亲缘关系已落库');
  assert(rels.length >= 1, '亲缘关系已落库');
  const status = await store.status();
  assert(status.entryCount >= 2 && status.relationCount >= 1, '状态汇总正确');

  const service = new OfflinePackService(store);
  const pack = await service.exportSelected(['守株待兔', '刻舟求剑'], { createdBy: 'itest' });
  assert(pack.entries.length === 2, '导出包含 2 个选定词条');
  assert(pack.relations.length === 1, '导出包含 1 条词条间关系');
  assert(pack.checksum.length === 8, '校验和为 8 位十六进制');

  console.log('\n[D] 新设备导入：空库 -> 全部新增');
  const storeB = new IndexedDbOfflineAdapter();
  // 同页面下 DB 名单例，这里用同库但清空模拟新设备
  await storeB.clear();
  const serviceB = new OfflinePackService(storeB);
  const raw = serializePack(pack);
  const insp1 = await serviceB.preview(raw, 'newer-wins');
  assert(!('fatal' in insp1), '兼容包预检通过');
  if (!('fatal' in insp1)) {
    assert(insp1.plan.every(p => p.conflict === 'new'), '空库预检全部为新增');
    const report1 = await serviceB.commit(insp1);
    assert(report1.accepted === 2, '导入新增 2 词条');
    assert(report1.relationsApplied === 1, '导入应用 1 关系');
  }

  console.log('\n[E] 二次导入：相同内容 -> 全部跳过，无副作用');
  const insp2 = await serviceB.preview(raw, 'skip');
  if (!('fatal' in insp2)) {
    assert(insp2.plan.every(p => p.conflict === 'identical'), '重复导入全部 identical');
    const report2 = await serviceB.commit(insp2);
    assert(report2.accepted === 0 && report2.skipped === 2, '相同内容全部跳过');
  }

  console.log('\n[F] 冲突合并：旧库 revision=1，包内 revision=2');
  const target = pack.entries.find(e => e.profile.idiom === '守株待兔')!;
  const updatedEntry: ProfileEntry = JSON.parse(JSON.stringify(target));
  updatedEntry.revision = 2;
  updatedEntry.updatedAt = '2027-01-01T00:00:00.000Z';
  updatedEntry.profile.modernDefinition = '修订后的释义';
  const packV2 = createPack([updatedEntry], [], { createdBy: 'v2' });
  const insp3 = await serviceB.preview(serializePack(packV2), 'newer-wins');
  if (!('fatal' in insp3)) {
    const conflictRow = insp3.plan.find(p => p.key === '守株待兔');
    assert(conflictRow?.conflict === 'conflict', '检出冲突');
    const report3 = await serviceB.commit(insp3);
    assert(report3.overwritten === 1, '冲突按 newer-wins 覆盖 1 条');
    const merged = await storeB.getEntry('守株待兔');
    assert(merged!.revision === 2 && merged!.profile.modernDefinition === '修订后的释义', '落库为包内新版本');
  }

  console.log('\n[G] newer-wins 保留本地更新版本');
  const target2 = pack.entries.find(e => e.profile.idiom === '守株待兔')!;
  const oldEntry: ProfileEntry = JSON.parse(JSON.stringify(target2));
  oldEntry.revision = 3;
  oldEntry.updatedAt = '2025-01-01T00:00:00.000Z'; // 时间更早
  oldEntry.profile.modernDefinition = '包内旧释义';
  const packOld = createPack([oldEntry], [], {});
  const insp4 = await serviceB.preview(serializePack(packOld), 'newer-wins');
  if (!('fatal' in insp4)) {
    await serviceB.commit(insp4);
    const kept = await storeB.getEntry('守株待兔');
    assert(kept!.profile.modernDefinition === '修订后的释义', '时间更新者胜：保留本地');
  }

  console.log('\n[H] 事务性：清空后库为空');
  await storeB.clear();
  const st = await storeB.status();
  assert(st.entryCount === 0 && st.relationCount === 0, '清空生效');

  console.log('\n[I] 校验和工具稳定性');
  assert(fnv1a('abc') === fnv1a('abc'), 'FNV-1a 确定性');
  assert(fnv1a('abc') !== fnv1a('abd'), '不同输入不同哈希');

  console.log(`\n结果: ${passed} 通过 / ${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
