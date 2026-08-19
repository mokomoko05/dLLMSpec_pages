# dLLMSpec Pages

推测解码论文、trace 与训练实验的静态展示站点。

<p><a href="https://mokomoko05.github.io/dLLMSpec_pages/"><strong>打开 Pages 页面 →</strong></a></p>

## 内容

- Speculative Decoding Trace Dashboards：DFlash、DSpark 与 EAGLE-3 的 step-level trace。
- 并行 Draft 方法依赖图：论文关系、方法摘要与本地复现结果；当前 Domino 阶段性结果为 10/32 点。
- DSpark 训练：从 smoke、5K pilot 到 30K 两轮训练，并补充 Speculators online / offline / hybrid hidden-state 流程与 step-time 分解。

## 仓库结构

根目录只保留站点入口和目录页样式；每个内容条目独立放在一个文件夹中：

- `paper-landscape/`：论文依赖图、脚本、摘要和图表资产。
- `dspark-training/`：DSpark 训练实验报告及专用样式。
- `speculative-trace-dashboard/`：trace 汇总页、manifest 和全部数据集 dashboard。

## 数据来源

原始数据和实验记录保存在 private repo（需要仓库权限）：

- [Trace dashboard collection](https://github.com/mokomoko05/dLLMSpec/tree/main/agentWorkSpace/speculative_trace_dashboard)
- [DSpark train smoke](https://github.com/mokomoko05/dLLMSpec/tree/main/agentWorkSpace/20260816_154529_dspark_speculators_train_smoke)
- [DSpark Qwen3-8B 5K pilot](https://github.com/mokomoko05/dLLMSpec/tree/main/agentWorkSpace/20260816_181530_dspark_speculators_qwen3_8b_5k_pilot)
- [DSpark Qwen3-8B 30K × 2 epochs](https://github.com/mokomoko05/dLLMSpec/tree/main/agentWorkSpace/20260816_210837_dspark_speculators_qwen3_8b_30k_2ep)
- [Papers and reproduction workspace](https://github.com/mokomoko05/dLLMSpec)
