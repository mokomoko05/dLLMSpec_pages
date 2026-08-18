# 推测解码论文演进与本地复现地图

本目录提供一份可离线打开的中文交互式文档，按时间顺序梳理 EAGLE-3、DFlash、
DDTree、Domino、DSpark、DominoTree、xPress 与 DARTree，并将仓库内已经完成的
复现结果放回论文实验语境中对照。

## 使用方式

直接用浏览器打开 `index.html`。页面不依赖 CDN、外部字体、构建工具或后端服务；
依赖连线由内联 SVG 绘制，论文表格图片来自仓库内对应 PDF。

```bash
xdg-open docs/speculative_decoding_landscape/index.html
```

页面包含：

- 将八篇论文组织为“起点方法 → 结构化改进 → 混合与并行化”的紧凑依赖图；
- 用虚线表示直接方法继承，用点线表示核心对比或共享基础；
- 每张节点卡片内显示论文 `Table 1` 缩略图；
- 点击节点后，在图下方唯一预览窗用选项卡切换方法图、主结果、serving、消融和
  trade-off 等代表性实验；
- 已完成复现的论文另有“本地复现结果”选项卡，直接显示 HTML 表格，不需要跳转到
  Markdown 报告；
- 独立的 `method_summaries.md` 对八种方法逐篇摘录论文摘要、翻译关键段落、解释实现，
  并明确标记 `training` / `training-free`；
- 本地 PDF、arXiv、官方仓库和本地实验报告链接；
- 小屏幕保持完整依赖图并允许横向滚动。

## 数据口径

本页面将以下四类证据分开显示：

1. **论文报告值**：来自仓库 `papers/` 下对应版本 PDF；
2. **正式本地复现**：来自已归档的 `agentWorkSpace/` 报告；
3. **部分可比结果**：DFlash Table 3 风格实验的 speculative 40/40 点已经完成，
   DFlash 与 EAGLE-3 可互比；baseline 仍为旧 non-overlap，页面不计算跨调度 speedup；
4. **本地方法扩展**：例如 DSpark dynamic tree，只说明本地探索，不冒充论文复现。

不同论文使用 H100、H200、RTX A6000、RTX 6000 Ada 等硬件，本地使用 A100
40GB/80GB；不同方法还可能使用不同 checkpoint、block/tree budget、框架、attention
backend 和统计口径。因此页面不对不匹配的绝对吞吐作统一排名。只有原始报告明确认定
可比的设置才计算相对差异。

## 本地复现来源

- EAGLE-3：`agentWorkSpace/20260809_171833_eagle3_reproduction/README.md`
- DFlash / EAGLE-3 Table 1：
  `agentWorkSpace/20260816_125046_dflash_table1_reproduction_summary/DFlash_Table1_reproduction_vs_paper.md`
- DFlash / EAGLE-3 Table 3 风格 Spec-v2：
  `agentWorkSpace/20260817_183558_dflash_table3_specv1_eagle3_qwen3/FINAL_SPECV2_RESULTS.md`
- DSpark Qwen3-8B：
  `agentWorkSpace/20260811_174925_dspark_qwen3_8b_official_reproduction/FINAL_ACCEPTANCE_REPORT.md`
- DSpark Qwen3-14B：
  `agentWorkSpace/20260815_qwen3_14b_dspark_paper_reproduction/FINAL_REPORT.md`
- DSpark dynamic tree 扩展：
  `agentWorkSpace/20260815_deepspec_dynamic_tree/TREE_ACCEPTANCE_REPORT.md`

## 分支与变更边界

这是文档与前端代码整理，不启动新实验，因此不新建 `agentWorkSpace/<timestamp>_*`
目录。Table 3 汇总复用原实验目录，因为它是同一实验边界内的结果验收。HTML、CSS
和 JavaScript 属于代码修改，按仓库规范在独立分支
`docs/table3-specv2-paper-tabs` 完成。

- 本次 clean 起点：`main` / `2ed074c`
- 修改范围：`docs/speculative_decoding_landscape/` 与 Table 3 实验的精简结果文档
- submodule：未修改
- 正在运行的实验 worktree、进程与 GPU：未触碰

## 文件

- `index.html`：语义结构与静态内容入口；
- `styles.css`：紧凑依赖图、节点卡片和统一预览窗布局；
- `app.js`：论文数据、依赖关系、SVG 连线与预览切换；
- `method_summaries.md`：论文原文短摘录、中文翻译、机制解释与训练属性判定；
- `assets/`：论文 Table 1、代表性表格页和 arXiv HTML 原始方法/结果图；
- `README.md`：口径、来源与维护说明。

更新数值时，应先修改对应实验报告并完成验收，再同步 `app.js` 中的展示值；不要把
运行中日志、未经核验的中间值或跨硬件派生 speedup 直接写入页面。
