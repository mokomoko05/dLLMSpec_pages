# 方法摘要：原文摘录、翻译与解释

这是一页“先读论文、再看图”的方法摘要。每节的 **English excerpt** 是对应版本论文摘要中的连续短摘录（保留原文术语；为控制篇幅用 `…` 省略未摘录句），随后给出中文翻译和面向实现的解释。`training` 指该方法本身需要训练或微调 drafter；`training-free` 指方法提出后不需要新增参数训练，但它可以建立在一个已经训练好的 base drafter 上。

## 一览：训练属性

| 方法 | 属性 | 判断依据 |
|---|---|---|
| EAGLE-3 | **training** | 需要为每个 target 训练 EAGLE-3 draft model，并使用 training-time test。 |
| DFlash | **training** | 训练 block-diffusion drafter，使其对齐冻结 target 的 hidden features / logits。 |
| DDTree | **training-free** | 直接消费 DFlash 的 per-position distributions，用 heap 构树；没有新的可学习模块。 |
| Domino | **training** | 并行 backbone、Domino GRU head 和 base-anchored curriculum 都要联合训练。 |
| DSpark | **training** | 半自回归 head、distribution matching 与 confidence head 需要训练；部署时再做调度。 |
| DominoTree | **training-free** | 复用已发布 Domino correction head，只改变候选树评分和 GPU 构树。 |
| xPress | **training** | causal refiner 与 DFlash drafter 联合训练，并优化 speculative acceptance。 |
| DARTree | **training-free** | 复用预训练 AR correction head，把 chain 扩展成 depth-wise batch tree。 |

> 注意：这里的分类回答“使用该方法时是否要为方法新增训练”。例如 DDTree 是 training-free，但没有一个已经训练好的 DFlash 就没有可消费的边缘分布；这不等于 DFlash 本身不需要训练。

<a id="eagle3"></a>

## EAGLE-3

**论文**：*Scaling up Inference Acceleration of Large Language Models via Training-Time Test*（arXiv:2503.01840v3）

**属性：`training`。** 训练一个与 target 配套的自回归 draft model；推理阶段仍需逐步 proposal 和 tree verification。

### English excerpt

> “We observe that scaling up data provides limited improvements for EAGLE. We identify that this limitation arises from EAGLE's feature prediction constraints. … EAGLE-3 … abandons feature prediction in favor of direct token prediction and replaces reliance on top-layer features with multi-layer feature fusion via a technique named training-time test.”

### 中文翻译

作者发现，扩大训练数据对 EAGLE 的收益有限，瓶颈来自 feature prediction 的约束。EAGLE-3 放弃 feature prediction，改为直接预测 token；同时不再只依赖 target 的顶层特征，而是通过 training-time test 融合多层特征。

### 怎么理解

EAGLE 原本在 feature 空间自回归，再借 target 的 LM head 得到 token 分布。EAGLE-3 把最终要接受的对象（token）直接作为训练目标，并混合低层、中层和高层 hidden states。`training-time test` 将推理时的“上一轮由 draft 自己产生的输入”搬进训练，减少 teacher forcing 与多步自反馈之间的分布偏移。它不是修改 target，也不是放松验证：target 仍逐候选执行严格的 speculative sampling，因此 lossless。

### 原文结果摘记

摘要报告最高 **6.5×** speedup、相对 EAGLE-2 约 **1.4×** 改善，以及 SGLang batch 64 下 **1.38×** throughput。数字依赖模型、任务、tree budget 和 backend，不能直接与本页其他论文的单流数字排名。

## DFlash

**论文**：*Block Diffusion for Flash Speculative Decoding*（arXiv:2602.06036v2）

**属性：`training`。** 训练轻量 block-diffusion drafter；target 冻结，仅在 drafting 时提供 context features。

### English excerpt

> “We introduce DFlash, a speculative decoding framework that employs a lightweight block diffusion model for parallel drafting. By generating draft tokens in a single forward pass and conditioning the draft model on context features extracted from the target model, DFlash enables efficient drafting with high-quality outputs and higher acceptance rates.”

### 中文翻译

DFlash 使用轻量的 block diffusion model 进行并行 drafting。它一次 forward 生成整个 draft block，并用从 target 提取的上下文特征作为条件，因此在降低 drafting 成本的同时保持较高质量和接受率。

### 怎么理解

输入由一个 clean anchor 和后续 mask 位置组成；drafter 一次预测每个位置的分布，而不是像 EAGLE 那样逐 token rollout。target 的多层 hidden states 被注入 draft 层的 KV cache，使小 drafter 不必独立承担完整语言建模。训练时随机采样 anchor、构造 masked block，并对 block 前部使用更高权重；推理时只取一条 chain，再由 target 验证。并行性来自 block diffusion，正确性来自 target verification，而不是来自 drafter 的独立生成能力。

### 原文结果摘记

摘要声称在多模型、多任务上超过 **6× lossless acceleration**，相对 EAGLE-3 最高 **2.5×** speedup。仓库的本地 Table 1 复现来自 A100，论文主结果来自其他 GPU，须按 README 的证据口径阅读。

## DDTree

**论文**：*Accelerating Speculative Decoding with Block Diffusion Draft Trees*（arXiv:2604.12989v1）

**属性：`training-free`。** 它是 DFlash 输出之上的 inference-time tree builder，不新增训练参数。

### English excerpt

> “We introduce DDTree (Diffusion Draft Tree), a method that constructs a draft tree directly from the per-position distributions of a block diffusion drafter. Under a fixed node budget, DDTree uses a simple best-first heap algorithm to select the continuations that are most likely to match the target model according to a surrogate defined by the draft model's output.”

### 中文翻译

DDTree 直接从 block-diffusion drafter 的逐位置分布构造 draft tree。在固定节点预算下，它用简单的 best-first heap，根据 drafter 输出定义的 surrogate，选择最可能与 target 匹配的延续。

### 怎么理解

DFlash 每个位置都算出了 top-k 分布，但 vanilla DFlash 只沿 top-1 组成一条链。DDTree 把这些边缘分布变成前缀闭合的候选树：从根开始，把当前概率最高的前缀放入 max-heap，弹出后扩展其子节点，直到达到预算。最后用 ancestor-only attention mask 在一次 target forward 中验证整棵树。它不改变 DFlash 的 drafter，也不训练新的 tree scorer；预算增大通常提高接受长度，却同时增加 verification 成本，所以 speedup 存在甜点区。

### 原文结果摘记

论文在固定节点预算下报告相对 vanilla DFlash 的提升，并强调 tree 是从已有 per-position distributions 构造的。DDTree 的收益属于“覆盖更多路径”，不是单条 draft 质量提升；因此应同时看 accepted length 和 verification latency。

## Domino

**论文**：*Decoupling Causal Modeling from Autoregressive Drafting in Speculative Decoding*（arXiv:2605.29707v1）

**属性：`training`。** 并行 backbone 与轻量 Domino GRU correction head 需要训练，且训练过程使用 base-anchored curriculum。

### English excerpt

> “Domino first uses a parallel draft backbone to produce preliminary draft distributions for the entire block, and then applies a lightweight Domino head to refine them with prefix-dependent causal information. To stabilize teacher-forced causal encoding, we further introduce a base-anchored training curriculum…”

### 中文翻译

Domino 先用并行 draft backbone 为整个 block 产生初始分布，再用轻量 Domino head 注入依赖前缀的因果信息进行修正。为了稳定 teacher-forced 的因果编码，作者引入了以 base 为锚点的训练课程。

### 怎么理解

DFlash 的位置分布便宜但相互独立；纯自回归 head 因果正确却逐 token 昂贵。Domino 将两者拆开：backbone 一次处理全 block，GRU 沿 draft chain 传播已生成 token 的状态，只修正 logits，不重跑完整 drafter。训练先让 backbone 学会稳定的并行预测，再逐步把优化重心移到 causally corrected distribution，缓解“训练时看真 token、推理时看采样 token”的错位。由于 correction 仍是顺序的，Domino 的重点是降低而非消除 draft 串行成本。

### 原文结果摘记

摘要报告 Transformers backend 最高 **5.49×** end-to-end speedup、SGLang 最高 **5.8×** throughput speedup。这里的训练属性不能与“推理时是否 autoregressive”混淆：Domino 是训练方法，推理 draft 则是半自回归。

## DSpark

**论文**：*Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation*（arXiv:2607.05147v1）

**属性：`training`。** 需要训练 semi-autoregressive drafter 以及估计 prefix survival probability 的 confidence head；调度器本身是 inference-time 组件。

### English excerpt

> “DSpark utilizes a semi-autoregressive architecture, coupling a parallel backbone with a lightweight sequential module, to introduce intra-block dependency modeling and mitigate suffix decay. … DSpark employs confidence-scheduled verification, dynamically tailoring the verification length for each request based on estimated prefix survival probabilities and engine-specific throughput profiles.”

### 中文翻译

DSpark 将并行 backbone 与轻量顺序模块结合，形成半自回归架构，以建模 block 内依赖并缓解后缀接受率衰减。它还根据估计的前缀存活概率和引擎吞吐曲线，为每个请求动态决定 verification 长度。

### 怎么理解

离线部分在 DFlash 式一次 block logits 上增加 Markov/RNN head，使第 i 个位置能看到前一个实际 token；训练损失同时包含 token cross-entropy、分布 matching 和 confidence loss。线上部分不是固定验证 7 或 16 个 token，而是把 confidence calibration 与并发负载结合：低负载倾向长 proposal，高负载提前截断高风险后缀，避免 target batch capacity 被浪费。因而 DSpark 的贡献跨越模型训练和 serving scheduler 两层。

### 原文结果摘记

论文还报告 DeepSeek-V4 live traffic 中相对 MTP-1 **60–85%** 的 per-user generation speed 提升（匹配 throughput 条件下）。本地 Qwen3 acceptance 复现与该线上指标是不同证据，不能混报。

## DominoTree

**论文**：*Conditional Tree-Structured Drafting with Domino for Speculative Decoding*（arXiv:2607.08642v2）

**属性：`training-free`。** 复用 Domino correction head；新工作是 conditional tree scoring、top-M 限制和 GPU-native builder。

### English excerpt

> “We introduce DominoTree, a training-free best-first draft tree scored by Domino's conditional, non-factorized correction along each root-to-node path, made practical by restricting the per-node correction to a candidate top-M set.”

### 中文翻译

DominoTree 是一个 training-free 的 best-first draft tree：沿每条根到节点的路径用 Domino 的条件、非因子化 correction 打分；为了可运行，把每个节点的 correction 限制在候选 top-M 集合内。

### 怎么理解

DDTree 假设各位置边缘分布可相乘，因此不同前缀在同一深度共享排序；DominoTree 沿每条路径推进 GRU state，所以同一位置会因前缀不同而得到不同 logits。top-M 先限制 vocabulary 扩张，GPU-native CUDA-graph builder 再把树构建留在设备端；论文说明 builder 与 Python reference bit-identical，故不改变 acceptance。它是“训练好的 Domino + 新的 inference tree search”，不是重新训练一个 tree drafter。

### 原文结果摘记

摘要在 Qwen3-4B 八个 benchmark 上报告最高 **6.6×** speedup、最高平均接受长度 **10.7 tokens/round**，并在不同温度下与 DDTree、CaDDTree 比较。树构建开销和各 harness 的 AR baseline 必须与 speedup 一起报告。

## xPress

**论文**：*Parallel Refinement for Diffusion Drafters in Speculative Decoding*（arXiv:2608.02438v1）

**属性：`training`。** causal refiner 与 DFlash block drafter 联合训练，且训练目标包含 speculative acceptance 对齐。

### English excerpt

> “Such independently sampled marginals tend to produce sequences with tokens that are individually likely, but jointly improbable under the target model's distribution… We propose xPress as a means to restore the missing causality in diffusion drafters. xPress is a lightweight causal refiner that reconciles the whole diffusion block at once through parallel refinement…”

### 中文翻译

独立采样的边缘分布容易生成“每个 token 单看都可能、合在一起却不符合 target 分布”的序列。xPress 用轻量 causal refiner 恢复 diffusion drafter 缺失的因果性，并通过并行 refinement 一次协调整个 block。

### 怎么理解

xPress 接受 DFlash 的初始 block logits。每一轮 Jacobi pass 都读取上一轮完整 block 的结果，同时更新所有位置；少量迭代即可把前缀信息传播到后缀，避免 Domino / DSpark 那种逐 token correction loop。它仍需训练 refiner，使“迭代次数 K、draft logits、target 接受率”共同匹配；因此不能把 xPress 的并行 refinement 误认为 training-free 的后处理。

### 原文结果摘记

摘要在 Qwen3-8B 七个 math、code、chat benchmark 上报告平均接受长度约 **+30%**（最高 **+56%**），端到端 throughput 平均约 **1.3×**（最高 **1.7×**）相对原始 DFlash。

## DARTree

**论文**：*Speculative Diffusion Decoding with Autoregressive Draft Trees*（arXiv:2608.13524v1）

**属性：`training-free`。** 将预训练 AR correction head 从 chain 推广到 tree；不训练新的 head 或 scorer。

### English excerpt

> “We introduce DARTree, a training-free speculative decoding method that extends a pretrained AR correction head from chains to trees. DARTree first constructs a fixed-width candidate tree by expanding and scoring all nodes at each depth in a single batch, and then only applies best-first pruning to select the verification tree…”

### 中文翻译

DARTree 是 training-free 方法，把预训练 AR correction head 从单条链扩展到树。它先按深度批量扩展并评分固定宽度的所有节点，再只在最后用 best-first pruning 选择要验证的树。

### 怎么理解

如果每次从 heap 弹出一个节点就调用 AR head，树搜索会重新变成串行。DARTree 先固定宽度逐层累积候选，让同一深度的 correction state 组成 batch；所有层完成后才做 pruning。这样把昂贵的 AR-head inference 与顺序 heap 操作解耦，同时保留路径条件信息。它依赖已有 correction head 的质量，却不改变其权重，所以训练属性应标为 training-free，而不是“没有模型训练历史”。

### 原文结果摘记

论文在七个 math、code、chat benchmark 的四种 model–temperature 配置中都报告最高平均接受长度和 speedup，最高 **12.97 tokens/round**、最高 **9.73× lossless speedup**。这些结果来自论文指定的本地 AR baseline；跨硬件复用时应重新测 baseline。

## 阅读顺序与证据边界

建议先读 EAGLE-3（训练约束）→ DFlash（并行 block）→ Domino / DSpark / xPress（恢复块内依赖）→ DDTree / DominoTree / DARTree（扩大树覆盖）。本页的英文摘录均来自论文摘要，机制解释综合论文正文与仓库 reading notes；速度数字只作为原文定位，不替代 PDF 中完整的实验条件。每篇原文、arXiv、代码和本地复现入口仍以[交互式地图](speculative-decoding-landscape.html)中的链接为准。
