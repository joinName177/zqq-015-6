# zqq-015 · 成语字源与语义DNA图谱

纯前端成语字源考据与语义拓扑分析系统。用户输入任意成语，系统拆解为四字金石甲骨字形溯源、典故出处时间轴与原文引证、语义流变路径，并测算生成该成语的"语义DNA"（本义/引申义/比喻义占比环形图及核心义原），支持任意两个成语的语义亲缘度交叉比对演算。

## 架构说明（分层架构：核心层 / 端口层 / 适配器层）

- `src/core`：领域模型（`OracleChar`、`AllusionSource`、`SemanticEvolutionStep`、`SemanticDNA`、`IdiomProfile`、`KinshipResult`）与欧氏DNA几何距离、义原Jaccard相似度算法；离线资料包领域模型（`OfflinePackage`、`PackageManifest`、`PackagedEntry`、`PackagedRelationship`）与包引擎（`package-engine`：稳定哈希、构建、版本校验、损坏恢复、冲突合并）。
- `src/ports`：端口层契约（`IdiomRepositoryPort` 典籍成语检索端口、`KinshipPort` 亲缘度比对端口、`OfflinePackagePort` 离线资料包端口）。
- `src/adapters`：适配器层（内置甲骨文字典与通用汉字语义生成适配器、亲缘比对分析适配器、合并典籍仓储适配器 `MergedIdiomRepository`、离线资料包适配器 `OfflinePackageAdapter`）。
- `src/ui`：原生 CSS 宣纸墨韵古典视觉呈现层，包含金石甲骨卡片、历史时间轴、语义DNA甜甜圈图表、双词亲缘竞技场与离线资料包面板（导出勾选、导入校验报告）。

## 离线资料包（Offline Package）

系统支持将选定词条及其关系数据导出为自包含的离线资料包（`.json`），并在重新导入时执行版本校验、冲突合并与损坏恢复；离线查询与在线查询共享同一模型。

- **导出**：勾选词条（内置 / 离线 / 自定义追加），系统自动打包词条资料及两两亲缘关系（`KinshipResult`），生成带版本清单（`formatVersion` / `appVersion` / `exportedAt`）与整体校验和（FNV-1a）的离线文件。
- **版本校验**：导入时校验包格式版本，高于当前支持的主版本则拒绝并提示升级，旧版本兼容导入。
- **冲突合并**：同名词条冲突提供三种策略——智能合并（本地优先、缺失字段由离线包补全）、跳过重复（保留本地）、覆盖（以离线包为准），并逐条记录冲突决议。
- **损坏恢复**：校验和不匹配时按条目级哈希复核并重建；条目缺字段时自动补全修复；文件被截断或 JSON 语法损坏时通过括号配平扫描抢救完整条目，最大限度挽回数据。
- **共享模型**：`MergedIdiomRepository` 实现与在线适配器相同的 `IdiomRepositoryPort`，离线词条优先命中、未命中回退在线典籍库，UI 面向端口编程，检索与亲缘比对均不区分数据来源。
- **持久化**：导入的离线数据存入 `localStorage`，刷新页面后离线词条与关系仍可查询。

## 本地运行

```bash
npm install
npm run dev
```

## 构建验证

```bash
npm run build
```

## Docker 容器化部署

```bash
docker compose up --build
```
访问：`http://localhost:8015`
