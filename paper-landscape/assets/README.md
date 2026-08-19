# 论文图表资产

本目录收录八篇论文的主结果、代表性服务/消融/trade-off 表，以及论文提供的代表性
方法图。目标不是搬运全部附录，而是让读者仅通过页面选项卡就能看懂“方法如何工作、
论文测了什么、主要结论由哪些实验支持”。所有资产保持原始内容，不重排或修改数值。

## Table 1

| 图片 | 来源 PDF | PDF 页码 |
| --- | --- | ---: |
| `eagle3_table1.png` | `papers/EAGLE-3_2503.01840v3.pdf` | 7 |
| `dflash_table1.png` | `papers/DFlash_2602.06036v2.pdf` | 6 |
| `ddtree_table1.png` | `papers/DDTree_Accelerating_Speculative_Decoding_with_Block_Diffusion_Draft_Trees_arXiv-2604.12989v1.pdf` | 10 |
| `domino_table1.png` | `papers/Domino_Decoupling_Causal_Modeling_from_Autoregressive_Drafting_in_Speculative_Decoding_arXiv-2605.29707v1.pdf` | 7 |
| `dspark_table1.png` | `papers/DSpark_paper.pdf` | 11 |
| `dominotree_table1.png` | `papers/DominoTree_Conditional_Tree-Structured_Drafting_with_Domino_for_Speculative_Decoding_arXiv-2607.08642v2.pdf` | 11 |
| `xpress_table1.png` | `papers/xPress_Parallel_Refinement_for_Diffusion_Drafters_in_Speculative_Decoding_arXiv-2608.02438v1.pdf` | 11 |
| `dartree_table1.png` | `papers/DARTree_Speculative_Diffusion_Decoding_with_Autoregressive_Draft_Trees_arXiv-2608.13524v1.pdf` | 6 |

## 代表性表格页

以下 PNG 使用 PDFium 2× 灰度渲染并裁去页边空白。部分页同时包含相邻的正文或多个
紧密相关表格，页面选项卡会说明应关注的表号。

| 资产 | 论文内容 | PDF 页码 |
| --- | --- | ---: |
| `eagle3_tables2_4.png` | 架构消融、SGLang batch throughput、batch=1 throughput | 8 |
| `dflash_tables2_4.png` | thinking、SGLang 高并发、长上下文 | 7 |
| `dflash_tables5_9.png` | 跨模型/框架、层数/features/block/conditioning 消融 | 8 |
| `dflash_tables11_12.png` | 无 feature 对照、跨模型结果与 vLLM serving | 12 |
| `dflash_table13.png` | anchor sampling 消融 | 13 |
| `ddtree_method.png` | Figure 2 方法示例与验证流程 | 5 |
| `domino_table2.png` | 高并发 throughput | 7 |
| `domino_tables3_4.png` | same-data 与 Domino head 消融 | 8 |
| `dominotree_table2.png` | paired-bootstrap throughput | 13 |
| `dominotree_tables3_4.png` | GPU-native builder | 14 |
| `dominotree_tables5_6.png` | conditioning 与 losslessness | 15 |
| `dominotree_tables7_8.png` | budget 与 candidate width | 20 |
| `xpress_table2.png` | vLLM serving | 11 |
| `xpress_table3.png` | refinement latency | 13 |
| `dartree_tables2_3.png` | tree construction 与 DSpark-head 消融 | 7 |
| `dartree_table4.png` | concurrent SGLang serving | 11 |

## 方法与结果图

SVG/PNG 来自对应 arXiv HTML 版本引用的原始图片文件，避免从 PDF 再次栅格化。它们
与仓库内 PDF 版本一致，并可离线打开。

| 论文 | 资产 | 图号 / 内容 |
| --- | --- | --- |
| EAGLE-3 | `eagle3_method.png` | Figure 5，推理 pipeline |
| EAGLE-3 | `eagle3_scaling_speedup.svg`、`eagle3_scaling_tau.svg` | Figure 1，训练数据 scaling |
| DFlash | `dflash_method.svg` | Figure 2，hidden-feature KV 注入 |
| DFlash | `dflash_draft_cost.svg` | Figure 3，draft cost |
| DDTree | `ddtree_budget_tradeoff.svg` | Figure 3，budget trade-off |
| DDTree | `ddtree_acceptance_histogram.svg` | Figure 4，接受长度分布 |
| Domino | `domino_method.png` | Figure 3，parallel backbone + causal head |
| Domino | `domino_latency_breakdown.svg` | Figure 1，延迟拆解 |
| Domino | `domino_curriculum_ablation.png` | Figure 4，训练策略消融 |
| DSpark | `dspark_method.svg` | Figure 1，模型与调度器 |
| DSpark | `dspark_proposal_latency.svg` | Figure 4，proposal length / latency |
| DSpark | `dspark_calibration.svg` | Figure 6，confidence calibration |
| DSpark | `dspark_load_adaptive.png` | Figure 8，负载自适应预算 |
| DominoTree | `dominotree_main_comparison.svg` | Figure 1，主方法对比；论文无独立架构总览图 |
| xPress | `xpress_method.svg` | Figure 2，parallel Jacobi refiner |
| xPress | `xpress_jacobi_iterations.svg` | Figure 3，Jacobi iteration 扫描 |
| DARTree | `dartree_method.svg` | Figure 3，depth-wise batched tree construction |
| DARTree | `dartree_width_budget.svg` | Figure 4，width / budget 敏感性 |

`Table 1` 裁图使用 PDFium 2.5× 灰度渲染；代表性整页使用 2×。页面提供“打开原图”
入口，可查看完整分辨率。
