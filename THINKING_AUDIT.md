# 网页实验 Thinking 设置审计

审计日期：2026-09-25

## 审计范围与方法

- 逐一检查 dLLMSpec_pages 当前收录的 53 个 HTML 文件，并对比本地各历史网页分支的 HTML 路径清单；各分支路径集合一致，没有遗漏仅存在于旧分支的页面。
- 对每个涉及数据集评测、性能测试或 trace 采集的表格，回查 dLLMSpec 仓库中的原始实验目录、启动脚本、benchmark 参数和报告。
- 优先采用脚本中显式的 enable_thinking 值；若参数为 store_true，则同时确认启动命令是否传入该开关。
- temperature=0 或 greedy 不能单独证明 Thinking 关闭，未将其作为判据。
- Qwen3 non-thinking 模板仍可能生成空的 think 控制片段；这不代表 Thinking 已开启。

## 页面结论

| 页面 | 审计结论 | 主要原始依据 |
|---|---|---|
| dartree-reproduction | 关闭 | DARTree evaluator 显式 enable_thinking=False |
| dflash-block-size | 关闭 | dflash.benchmark 的开关为 store_true，实验命令未传入 |
| dflash-hidden-refiner | 混合 | 训练与 validation 使用 thinking；在线数据集评测使用 non-thinking |
| dflash-multistep | 关闭 | multistep 启动命令未传入 store_true 开关；profile 显式 false |
| dflash-suffix-reuse | 关闭 | collect_traces.py 显式 false |
| dflash2-gdn-dag-cuda | 关闭 | benchmark_per_request.py 显式 false，实验计划亦明确 thinking off |
| dflash2-packed-tree | 关闭 | 对应 DFlash2 benchmark 协议显式 false |
| dflash2-selector-training | 关闭 | 对应在线数据集评测采用 non-thinking 协议 |
| dspark-training | 关闭 | 该页复现实验采用 non-thinking 评测协议 |
| dtree-rejected-token-trace | 关闭 | trace collector 显式 false；DARTree 子流程同样显式 false |
| elastic-dartree | 关闭 | 对应数据集实验沿用 non-thinking evaluator |
| experiment-results | 关闭 | Domino 实验计划明确 thinking 关闭；另一结果采用同一 non-thinking 协议 |
| packed-breakdown | 关闭 | benchmark 开关为 store_true，启动命令未传入 |
| qwen38-dflash2-dspark | 混合 | DSpark 服务对比为 thinking=xhigh；tree 与官方复现实验为关闭 |
| speculative-trace-dashboard | 关闭 | DFlash、DeepSpec、EAGLE 三类 trace collector 均显式 false |
| paper-landscape | 不适用 | 文献综述与方法汇总，不是单一数据集评测 run |

## 重点原始证据

- DARTree：agentWorkSpace/20260823_dartree_reproduction/upstream/eval_dartree.py。
- DFlash benchmark：implementations/dflash/dflash/benchmark.py；enable-thinking 为显式 store_true 参数。
- suffix reuse：agentWorkSpace/20260829*/dflash_baseline/collect_traces.py。
- rejected-token trace：agentWorkSpace/20260904*/collect_gsm8k_rejection_trace.py。
- DSpark xhigh：agentWorkSpace/20260822*/benchmark_datasets.py 和 smoke.py，均传入 enable_thinking=True 与 reasoning_effort=xhigh。
- GDN/tree：agentWorkSpace/20260919_142207*/scripts/benchmark_per_request.py，以及 20260923 cache-reuse 实验计划。
- speculative trace：tools/trace/run_dflash_trace.py、run_deepspec_trace.py、run_eagle_trace.py。

## 网页标注策略

- 页面只有一种协议时，在页面摘要和所有相关数据表 caption 标注 Thinking：关闭。
- 页面混合多种协议时，页面摘要标为混合，并在每张表上分别标注关闭、开启或 xhigh。
- 36 个独立 trace dashboard 没有统一数据表 caption，因此在页面顶部加入显式 non-thinking 横幅。
- paper-landscape 未添加实验状态样式，因为它不是单一实验结果页。
