# zqq-015 · 成语字源与语义DNA图谱

纯前端成语字源考据与语义拓扑分析系统。用户输入任意成语，系统拆解为四字金石甲骨字形溯源、典故出处时间轴与原文引证、语义流变路径，并测算生成该成语的"语义DNA"（本义/引申义/比喻义占比环形图及核心义原），支持任意两个成语的语义亲缘度交叉比对演算。

## 架构说明（分层架构：核心层 / 端口层 / 适配器层）

- `src/core`：领域模型（`OracleChar`、`AllusionSource`、`SemanticEvolutionStep`、`SemanticDNA`、`IdiomProfile`、`KinshipResult`）与欧氏DNA几何距离、义原Jaccard相似度算法。
- `src/ports`：端口层契约（`IdiomRepositoryPort` 典籍成语检索端口、`KinshipPort` 亲缘度比对端口）。
- `src/adapters`：适配器层（内置甲骨文字典与通用汉字语义生成适配器、亲缘比对分析适配器）。
- `src/ui`：原生 CSS 宣纸墨韵古典视觉呈现层，包含金石甲骨卡片、历史时间轴、语义DNA甜甜圈图表与双词亲缘竞技场。

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
