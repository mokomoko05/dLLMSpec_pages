# 方法摘要：计算流程、张量形状与代码证据

本页追踪一次 drafting round 中的数据怎样流过模型、树构造器和 target verifier。统一记号：`N` 为 batch size，`T` 为已确认上下文长度，`H` 为 hidden size，`V` 为 vocabulary size，`B` 为 block 或最大 draft 深度，`R` 为低秩维度。`M/K/W` 的含义在各节重新定义。所有“无损”均指最终 token 仍经过 target model 的标准 speculative sampling 或 greedy verification；drafter 的近似不会直接提交。

| 方法 | 是否新增训练 | 核心计算 |
|---|---|---|
| EAGLE-3 | training | 三层 target feature 融合 + 单层自回归 draft decoder + 动态树 |
| DFlash | training | target feature 注入每层 KV + 一次并行 block denoising |
| DDTree | training-free | DFlash 逐位置边缘分布的 top-prefix heap |
| Domino | training | DFlash 并行 hidden + GRU 路径状态 + 低秩全词表修正 |
| DSpark | training | 并行 backbone + Markov/RNN head + 置信度调度 |
| DominoTree | training-free | Domino 路径条件修正驱动 DDTree best-first heap |
| xPress | training | 低秩因果 mixer + 少量 Jacobi 全块并行迭代 |
| DARTree | training-free | 固定层宽批量扩展 + 延迟 top-B 剪枝 |

## EAGLE-3

**论文**：*Scaling up Inference Acceleration of Large Language Models via Training-Time Test*（arXiv:2503.01840v3）。**官方源码**：[SafeAILab/EAGLE](https://github.com/SafeAILab/EAGLE)。`EAGLE` 是 Extrapolation Algorithm for Greater Language-model Efficiency 的项目名；EAGLE-3 是其第三版 drafter。

### 一轮究竟计算什么

target model 在 prefill 或上一轮 verification 中返回低、中、高三层 hidden states：

> $$L,M,U\in\mathbb{R}^{N\times T\times H},\qquad G=W_f[L;M;U],\quad W_f\in\mathbb{R}^{H\times3H}.$$

`[L;M;U]` 沿最后一维拼接成 `[N,T,3H]`，全连接层压回 `[N,T,H]`。对最后一个已采样 token `y_t`，其 embedding `e(y_t)∈R^H` 与融合 feature `g_t∈R^H` 一起进入只有一个 Transformer decoder layer 的 draft model。官方实现不是先做普通 `2H→H` 再 attention：`e(y_t)` 与 `g_t` 在 decoder layer 内拼成 `[N,1,2H]`，Q/K/V projection 直接读取 `2H` 输入，layer 输出仍为 `[N,1,H]`。随后复用 target language-model head：

> $$a_{t+1}=D_\theta(e(y_t),g_{\le t})\in\mathbb{R}^{H},\qquad z_{t+1}=W_{LM}a_{t+1}\in\mathbb{R}^{V}.$$

采样得到 `y_(t+1)` 后，下一步没有 target feature `g_(t+1)`，于是把上一步的 unconstrained vector `a_(t+1)` 当作该位置的 feature，再与新 token embedding 组合。因而 draft depth 仍是顺序计算，KV cache 保存前面 draft state；它不是一次并行预测整个 block。

### 为什么删除 feature regression

早期 EAGLE 同时优化下一 target feature 的回归损失与 token loss。EAGLE-3 只要求 `W_LM a` 预测正确 token，不再强迫 `a` 拟合 target 顶层 hidden state：

> $$\mathcal L_{token}=-\sum_t\log\operatorname{softmax}(W_{LM}a_t)_{x_{t+1}}.$$

`a_t` 可以成为最适合 token prediction 的内部表示，而非 target feature 的数值复制。代价是训练时若始终输入真实 `G`，推理第 2 步开始输入自身 `a` 会产生分布偏移。

### Training-time test 的数据流

`training-time test` 不是测试集训练，而是在训练图里模拟多步 rollout。第 1 次 pass 读取真实融合 feature；其输出 `a^(1)` 被送回第 2 次 pass，第 2 次输出再送入第 3 次。不同 rollout 分支共享一个大 attention 计算：真实序列之间使用下三角 causal mask，自生成位置只连接其对应父路径。训练样本因此同时覆盖“输入仍是真实 `G`”和“输入已经是自身 `a`”的状态。

推理沿用 EAGLE-2 动态树：每个 draft step 产生若干 top-k token，按路径概率选择候选节点，flatten 后用 ancestor-only tree attention 一次 target forward 验证。树节点 position id 等于树深，同深不同分支互不可见。

### 代码对照与边界

- `implementations/EAGLE/eagle/model/cnets.py`：`fc` 实现 `3H→H` feature fusion；decoder layer 将 token embedding 与 hidden 拼接；`tree_mask` 注入树 attention。
- `implementations/EAGLE/eagle/traineagle3/cnets.py`：`dataprepare()` 拼接三层 target hidden，训练 forward 回灌自生成 hidden。
- 论文只把三路 feature 称为 low/middle/high；具体 layer index 随 target/checkpoint 配置变化，不能写死成统一层号。

## DFlash

**论文**：*Block Diffusion for Flash Speculative Decoding*（arXiv:2602.06036v2）。**官方源码**：[z-lab/dflash](https://github.com/z-lab/dflash)。`DFlash` 使用 block diffusion（块扩散）drafter：一个 forward 同时输出未来 block 的所有位置。

### Target context 怎样进入每一层

target 返回 `m` 个选定层的 hidden state `F^(l)∈R^[N,T,H]`。先拼接、投影并归一化：

> $$C=\operatorname{RMSNorm}(W_c[F^{(l_1)};\ldots;F^{(l_m)}]),\quad W_c\in\mathbb{R}^{H\times mH},\quad C\in\mathbb{R}^{N\times T\times H}.$$

输入 block 是一个已确认 anchor 加 mask slots：`X=[e(b),e(mask),…,e(mask)]∈R^[N,B,H]`。每个 draft Transformer layer 都把 `C` 直接注入 Key/Value，而非只在第一层输入相加：

> $$Q=XW_Q,\qquad K=[CW_K;XW_K],\qquad V=[CW_V;XW_V].$$

若 query head 数为 `n_q`、KV head 数为 `n_kv`、head dimension 为 `d_h`，则 `Q` reshape 为 `[N,n_q,B,d_h]`，`K/V` 为 `[N,n_kv,T+B,d_h]`；grouped-query attention 将每个 KV head 共享给 `n_q/n_kv` 个 query heads。注入后的 target context KV 被缓存，drafting 后续轮只追加新 query block。

### 一次并行 proposal

`L_d` 层 backbone 输出 `Z∈R^[N,B,H]`，冻结的 target LM head 生成 `U=ZW_LM^T∈R^[N,B,V]`。各 mask position 从自己的 `U_i` 同时采样，所以 proposal 的近似联合分布是

> $$q(d_{1:B}\mid C,b)=\prod_{i=1}^{B}q_i(d_i\mid C,b),\qquad q_i=\operatorname{softmax}(U_i).$$

关键限制是 `q_i` 不读取本轮实际采样的 `d_<i`；mask block 内虽可双向 attention，读到的仍是 mask/anchor 表示，不是离散采样结果。target verification 则计算 `p_T(d_i|C,b,d_<i)`，从左到右接受到首次 mismatch。greedy 模式比较 target argmax；采样模式使用标准 `min(1,p/q)` acceptance 和 residual distribution，保持 target 分布。

### 训练矩阵与损失

训练先用冻结 target 对完整 clean sequence 求多层 hidden；随机选择 response anchor，每个 anchor 后放 `B-1` 个 mask。多个 block 拼成一条训练序列：同 block 内双向可见、block 间不可见、每个 block 可读取对应 target context。训练一次可并行处理多个 anchor。

位置 `k` 的 cross-entropy 乘指数衰减权重：

> $$w_k=\exp(-(k-1)/\gamma),\qquad\mathcal L=-\sum_{k=1}^{B-1}w_k\log q_k(x_k^*).$$

早位置错误会让整个后缀作废，因此权重前高后低。embedding 和 `W_LM` 与 target 共享且冻结，只训练 context projector 与 draft Transformer。

### 代码对照与 Qwen3-4B 形状

本仓库 Qwen3-4B checkpoint 使用 `H=2560`、`V=151936`、5 个 target layers、5 个 draft layers。拼接是 `[N,T,12800]`，`W_c` 为 `[2560,12800]`；32 query heads、8 KV heads、`d_h=128`，Q/K/V/O 权重输出宽度分别为 4096/1024/1024/2560。

- `implementations/speculators/src/speculators/models/dflash/core.py`：context projection、masked block 与并行 logits。
- `implementations/speculators/src/speculators/models/dflash/attention.py`：每层 target-context KV injection。
- `docs/DIFFUSION_DRAFTER_CAUSAL_ARCHITECTURES.md`：按实际 checkpoint 展开的 Qwen3 张量和运行时 cache。

## DDTree

**论文**：*Accelerating Speculative Decoding with Block Diffusion Draft Trees*（arXiv:2604.12989v1）。**官方源码**：[liranringel/ddtree](https://github.com/liranringel/ddtree)。`DDTree` 即 Diffusion Draft Tree，不训练新模型；输入就是一次 DFlash forward 已有的逐位置 logits。

### 从 `[L,V]` logits 到前缀概率

设 DFlash 可提出 `L` 个未来位置，logits `ℓ∈R^[L,V]`，逐位置边缘分布 `q_i(v)=softmax(ℓ_i)_v`。由于没有路径条件概率，DDTree 明确采用 factorized surrogate：

> $$Q(y_{1:L}\mid c,b)=\prod_{i=1}^{L}q_i(y_i\mid c,b).$$

树节点是非空 token prefix `u=(u_1,…,u_d)`，树必须 prefix-closed。某 continuation 在树中可接受的 surrogate 长度等于它命中的最长树前缀。论文证明其期望可写为树内每个节点的 prefix mass 之和：

> $$\mathbb E_{Y\sim Q}[\alpha_T(Y)]=\sum_{u\in T}q(u),\qquad q(u)=\prod_{i=1}^{|u|}q_i(u_i).$$

固定节点预算 `B_node` 下，只需选 prefix probability 最大的 `B_node` 个节点；子 prefix 概率不大于父 prefix，top 集合天然 prefix-closed。注意这是对 `Q` 的精确最优，不是对未知 target path distribution 的最优。

### Heap 如何不枚举 `V^L`

每个 depth 先取 `K=min(B_node,V)` 个 token，得到 ids/probabilities `[L,K]`。用 rank tuple `ρ=(ρ_1,…,ρ_d)` 表示路径，score 为

> $$\sigma(\rho)=\sum_{i=1}^{d}\log q_i^{(\rho_i)}.$$

max-heap 初始只有 `(1)`。每弹出一个 prefix，只生成两个邻居：同父节点的下一个 sibling `(ρ_1,…,ρ_d+1)`，以及最佳 child `(ρ_1,…,ρ_d,1)`。sibling score 用减旧边、加新边 O(1) 更新；child 只加下一 depth 的 top-1 log-probability。`B_node` 次 pop、至多 `2B_node` 次 push，heap 复杂度 `O(B_node log B_node)`。

### Tree compile 与 target verification

构树得到 `node_token_ids[B_node]`、`node_depths[B_node]`、`parents[B_node+1]`。visibility matrix `A∈{0,1}^[(B_node+1)×(B_node+1)]` 的第 `i` 行只标记 root、ancestors 和自身；position id 是 `start+depth`。flatten 的 `[bonus; nodes]` 进入一次 target forward。随后从 root 出发，若 target 在当前节点预测的 token 存在于 child map 就沿该 child 接受，否则停止；KV cache 只保留接受路径。

### 代码对照

- `agentWorkSpace/20260826_ddtree_official_reproduction/upstream/ddtree.py`：`build_ddtree_tree()` 对 `[L,V]` 做 top-k、CPU heap、parent/visibility；`compile_ddtree_tree()` 生成 position/attention；`follow_verified_tree()` 沿 target posterior 走树。
- 官方实现 top-k 和 logsumexp 在 GPU，随后把 `[L,K]` token/log-probability 拷到 CPU 做 heap。这解释了 budget 增大为何同时增加 copy、heap 和 target verification 成本。

## Domino

**论文**：*Decoupling Causal Modeling from Autoregressive Drafting in Speculative Decoding*（arXiv:2605.29707v1）。**官方源码**：[jianuo-huang/Domino](https://github.com/jianuo-huang/Domino)。`Domino` 将“昂贵 block representation”和“必须顺序的 token dependency”拆成两个计算支路。

### 并行 base 与顺序 correction

DFlash-style backbone 一次产生 `H_blk∈R^[N,B,H]` 和 `L_base∈R^[N,B,V]`。Domino 不为每个 token 重跑 Transformer；它仅沿采样链更新门控循环单元（Gated Recurrent Unit, GRU）状态 `S_i∈R^[N,G]`：

> $$S_i=\operatorname{GRU}(E(x_i),S_{i-1}),\qquad E(x_i)\in\mathbb R^{H}.$$

对位置 `i+1`，拼接并行 hidden 与路径状态 `[H_(i+1);S_i]∈R^[N,H+G]`，经过低秩多层感知机（Multi-Layer Perceptron, MLP）输出全 vocabulary residual：

> $$\Delta L_{i+1}=W_2\operatorname{SiLU}(W_1[H_{i+1};S_i]),\quad W_1\in\mathbb R^{R\times(H+G)},\quad W_2\in\mathbb R^{V\times R}.$$

最终 `L_i=L_i^base+ΔL_i`，采样 `x_i` 后再更新 GRU。backbone latency 近似一次 block pass，串行部分只剩 `B` 次 GRU 与低秩投影。

### Qwen3-4B 的实际矩阵

发布 checkpoint 为 `H=2560`、`G=1024`、`R=256`、`V=151936`。PyTorch GRU 参数为 `W_ih∈R^[3072,2560]`、`W_hh∈R^[3072,1024]`；correction 输入宽 3584，`W_1=[256,3584]`，`W_2=[151936,256]`。correction 分支约 50.8M parameters（不含共享 DFlash backbone）。`pure_draft_prefix_len=1` 时第一个 proposal 直接取 base logits，后续位置才执行 GRU correction。

### 训练为何用 teacher forcing

只有前面 token 已被 target 接受时，后面 correction 才影响最终 acceptance，因此论文让 GRU 在训练时读取 ground-truth prefix，而非早期噪声很大的自采样 prefix。为防止干净 prefix 让 correction branch 取代 backbone，loss 使用 base-anchored curriculum：

> $$\mathcal L=(1-\lambda_t)\mathcal L_{final}+\lambda_t\mathcal L_{base},\qquad\lambda_t:1\rightarrow0.$$

两项都是 position-decayed cross-entropy。训练初期强制 `L_base` 本身有用，后期逐渐让 corrected logits 主导。推理串行 loop 由 Triton kernels 与 CUDA Graph 降低 launch overhead，但数学依赖仍逐 token。

### 代码对照

- `agentWorkSpace/20260823_dartree_reproduction/upstream/utils/draft_model.py`：发布 Domino checkpoint 的 GRU、`[H;S]→R→V` projector 与逐位置 correction。
- `docs/DIFFUSION_DRAFTER_CAUSAL_ARCHITECTURES.md`：给出 GRU gate 公式、参数量和 block 对齐。

## DSpark

**论文**：*Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation*（arXiv:2607.05147v1）。**官方源码**：[deepseek-ai/DeepSpec](https://github.com/deepseek-ai/DeepSpec)。`DSpark` 同时修改 drafter 和 serving scheduler；semi-autoregressive 表示大部分 block 并行算，只有很小的 transition head 顺序算。

### Markov 与 RNN 两种顺序头

parallel backbone 一次输出 `h∈R^[N,B,H]`、`U∈R^[N,B,V]`。默认 Markov head 只看前一个 token，完整 `V×V` transition matrix 用 rank `R=256` 分解：

> $$W_1\in\mathbb R^{V\times R},\quad W_2\in\mathbb R^{R\times V},\quad b_i=W_1[x_{i-1}]W_2\in\mathbb R^V,\quad p_i=\operatorname{softmax}(U_i+b_i).$$

代码中 `W_1` 是 embedding lookup，`W_2` 是 `R→V` linear。RNN variant 保存 `s_i∈R^R`，构造 `z_i=[s_(i-1);W_1[x_(i-1)];h_i]∈R^[2R+H]`，一个 linear 同时输出 gate/candidate/output 三个 `R`-vector，再用 output state 经 `W_2` 生成 vocabulary bias。两者都不重算 backbone hidden。

### Confidence head 预测什么

confidence `c_i` 不是“draft top-1 probability”，而是条件于前面都接受时，第 `i` 个 token 在标准 speculative sampling 下的期望接受概率。训练 soft label 来自 draft/target distribution 的 total variation distance：

> $$c_i^*=1-\tfrac12\lVert p_i^d-p_i^T\rVert_1,\qquad c_i=\sigma(w^T[h_i;W_1[x_{i-1}]]).$$

prefix survival 是 `a_(r,j)=∏_(i≤j)c_(r,i)`。论文再用 Sequential Temperature Scaling 按位置校准累计乘积，避免 raw confidence 过度自信。

### Hardware-aware scheduler 的数据流

对 `R_req` 个 active requests 和选择长度 `ℓ_r`，target verification token batch 是

> $$B_{verify}=\sum_r(1+\ell_r),\qquad\tau=\sum_r\left(1+\sum_{j=1}^{\ell_r}a_{r,j}\right).$$

引擎启动时 profile `SPS(B_verify)`（steps per second）表，在线目标为 `Θ=τ·SPS(B_verify)`。scheduler 把所有 request 的合法 prefix extension `(r,j)` 按 `a_(r,j)` 降序排列，逐个加入并查表更新 `Θ`，第一次不再提升就停止。累计概率随 depth 单调下降，所以排序不会违反单个 request 的 prefix closure；early stop 也避免决策读取尚未纳入的未来 sampled token，维持 non-anticipating property。

### 三项训练 loss

target、embedding 和 LM head 冻结；训练 backbone、sequential head、confidence head：

> $$\mathcal L=\mathcal L_{CE}+\alpha_{TV}\sum_iw_i\lVert p_i^d-p_i^T\rVert_1+\alpha_c\mathcal L_{BCE}(c_i,c_i^*),\quad w_i=e^{-(i-1)/\gamma}.$$

total variation 项直接对应 sampling acceptance，confidence BCE 只训练调度估计器。

### 代码对照

- `implementations/DeepSpec/deepspec/modeling/dspark/markov_head.py`：`VanillaMarkov`、gated 与 RNN variants 的矩阵及逐步 sampling loop。
- `implementations/DeepSpec/deepspec/modeling/dspark/loss.py`：CE、L1 distribution matching、confidence BCE 与累计校准统计。
- `implementations/DeepSpec/deepspec/modeling/dspark/qwen3/modeling.py`：并行 logits、Markov correction 和 confidence 输出的连接位置。

## DominoTree

**论文**：*Conditional Tree-Structured Drafting with Domino for Speculative Decoding*（arXiv:2607.08642v2）。**官方源码**：[slin-zhq/Domino-Tree](https://github.com/slin-zhq/Domino-Tree)。它不重新训练 Domino，而是把 chain correction state 放进 DDTree heap 的每个 entry。

### Heap entry 为什么多一个 GRU state

每轮 Domino backbone 只运行一次，得到每 depth 共享的 `H_d∈R^H` 与 `L_d^base∈R^V`。heap entry 是 `(prefix u, cumulative score g(u), GRU state S_d∈R^G)`。展开节点时使用该路径独有 state：

> $$\Delta L_d(S_{d-1})=W_2\operatorname{SiLU}(W_1[H_d;S_{d-1}]),\qquad\widetilde L_d=L_d^{base}+\Delta L_d.$$

children function 返回 top-k token、corrected log-probabilities 和每个 token 推进后的 child GRU state。新 entry score 为 `g(u||v)=g(u)+log q_tilde_d(v|u)`。同 depth 两个 prefix 共享 `H_d`，但 `S_(d-1)` 不同，children 排名也可不同；这正是 DDTree factorized marginals 没有的路径条件信息。

### 为什么先限制到 top-M

Qwen3 的 `V=151936`，每 pop 都做 `R=256→V` projection 会让 sequential heap 极慢。DominoTree 每 depth 先从 `L_d^base` 取共享 marginal top-M indices，收集 `W_2` 对应的 `M` 行，只计算：

> $$W_2[\mathcal C_d,:]r_u\in\mathbb R^M,\qquad\mathcal C_d=\operatorname{TopM}(L_d^{base}),\quad M\ll V.$$

单节点 projection 从 `256×151936` 缩为 `256×M`。这是候选截断近似：被 base logits 排除的 token 即使 correction 很大也不会考虑。论文明确报告 `M`，不能把它描述成完整 vocabulary 的 exact conditional tree。

### GPU builder 与 verification

best-first pop 顺序依赖上一 pop，整棵树无法静态 capture。实现保留 Python heap，只把固定 shape per-node correction capture 成 CUDA Graph，逐 pop replay；论文验证 eager 与 graphed builder bit-identical。最终树仍用 ancestor-only attention 一次 target forward 验证。

论文还测试 `θ(n)=(1+Φ(n))/(C_d+C_v(n))` 的 adaptive budget，`Φ(n)=Σ_(s≤n)π_s` 累计 heap path mass。但 Domino corrected score 系统性高估 target acceptance，规则几乎总跑到 cap；作者将其报告为负结果，正式方法采用 fixed budget。

### 代码证据边界

本仓库没有克隆 DominoTree 官方源码，因此矩阵与控制流来自论文 algorithm 和公开仓库说明，而非本地复现。官方仓库链接如上；本地 `utils/draft_model.py` 只能核实其复用的 Domino GRU/correction 数学，不能替代 DominoTree builder。

## xPress

**论文**：*Parallel Refinement for Diffusion Drafters in Speculative Decoding*（arXiv:2608.02438v1）。截至该版本，论文未给出公开代码仓库；可核查来源为 [arXiv 论文页面](https://arxiv.org/abs/2608.02438)。本节只写论文明确给出的结构和维度，不声称已有源码复现。

### Refiner 的四段张量流

DFlash 先产生 block hidden `h_1:B∈R^[B,H]` 与 base logits `s∈R^[B,V]`。xPress 设低秩 `R=256`，取全 block mean `g=(1/B)Σ_j h_j∈R^H`。对位置 `k`，融合当前 hidden、global hidden 和前一 token embedding：

> $$a_k=W_{in}[W_hh_k;W_gg;W_e[x_{k-1}]]\in\mathbb R^R,$$

其中 `W_h,W_g∈R^[R,H]`、`W_e∈R^[R,V]`、`W_in∈R^[R,3R]`。把 `A=[a_1,…,a_B]∈R^[R,B]` 按 channel 做严格下三角 mixing：

> $$c^{(d)}=(I_B+L^{(d)})a^{(d)},\qquad L^{(d)}\in\mathbb R^{B\times B}\text{ strictly lower triangular}.$$

position `k` 的 token-dependent 输入只来自 `x_<k`。再做 `R→2R→R` residual MLP 与 vocabulary readout：

> $$z_k=c_k+W_2\sigma(W_1c_k),\quad W_1\in\mathbb R^{2R\times R},\ W_2\in\mathbb R^{R\times2R},\quad\delta_k=W_rz_k\in\mathbb R^V.$$

corrected logits 是 `ℓ_k=s_k+δ_k`。`Fuse` 与 `Mix` 都是 linear，论文指出可预折叠为每 iteration 一个 batched matmul；这不是 attention，没有运行时 QK score。

### Jacobi 为什么能并行

若按因果定义顺序 decode，需要 `B` 次 refiner。xPress 从 DFlash argmax block `Y^(0)` 开始，每轮同时更新所有位置：

> $$y_k^{(j+1)}=\arg\max_v p_k(v\mid y_{<k}^{(j)},h,g),\qquad k=1,\ldots,B.$$

第 `j+1` 轮所有位置只读第 `j` 轮完整 block，因此一个 iteration 是一次全块并行 refiner。由于 dependency 严格因果且 `h,g` 固定，position 1 一轮后正确、position 2 至多两轮后正确，归纳得 position `k` 在 `j≥k` 时等于 sequential refiner；唯一 argmax/tie rule 固定时，至多 `B` 轮收敛到同一 fixed point。实验 block 16 通常约 6 轮进入 plateau，而不是声称任意输入都 6 轮严格收敛。

### Co-training loss

单个 distribution 的 position-weighted loss 是 ground-truth CE 加 target total variation：

> $$\mathcal L(p)=\sum_kw_k[\alpha_{CE}(-\log p_k(x_k^*))+\alpha_1\lVert p_k-p_k^T\rVert_1],\qquad w_k=e^{-(k-1)/\gamma}.$$

总 loss 同时作用于 teacher-forced refined distribution `p^r`、base drafter `p^b`、以及用 `argmax(p^b)` 自条件再跑一次得到的 `p_hat^r`：

> $$\mathcal L_{total}=\mathcal L(p^r)+\lambda\mathcal L(p^b)+\beta\mathcal L(\hat p^r).$$

第二项防止 co-training 让 DFlash seed 退化；第三项减少 teacher-forcing 与 Jacobi self-conditioning 的偏移。

### 证据边界

论文未公开 repo，因此不能给函数路径、kernel layout 或声称实际实现与公式逐行一致。页面中的 `assets/xpress_method.svg` 只是依据论文公式绘制的解释图，不是源码证据。

## DARTree

**论文**：*Speculative Diffusion Decoding with Autoregressive Draft Trees*（arXiv:2608.13524v1）。**官方源码**：[VILA-Lab/DARTree](https://github.com/VILA-Lab/DARTree)。`DARTree` 把已训练的 Domino/DSpark 式 autoregressive correction head 从单链扩展到树，不更新权重。

### 为什么 exact conditional heap 难并行

若每个 heap pop 后才用该 prefix 的 correction state 计算 children，下一 pop 必须等待当前 correction，node-level best-first 与 head inference 完全串行。DARTree 改成 depth-wise schedule：跨 depth 仍顺序，同一 depth 的 active paths 合并成 batch。

一次 block backbone 给出 `H_d∈R^H`、`L_d^base∈R^V`，每 depth 先取共享 candidate set `C_d=TopK(L_d^base,K)`。若上一层有 `W` 个 active prefixes，correction state 是 `[W,G]`，与广播后的 `H_d` 组成 batch；restricted corrected logits 为 `[W,K]`。展开 `W×K` 个 child，按累计 score 全局取 top-W：

> $$\widetilde q_d(\mathcal C_d\mid u_{<d})=g_{\mathcal C_d}(H_d,r(u_{<d})),\quad s_\beta(u_{1:d})=s_\beta(u_{<d})+\log\widetilde q_d(u_d\mid u_{<d})+\beta.$$

被选 child 的 token、parent index、score 与 correction state 一起 gather 到下一层。重复 `B_depth` 次得到最多 `B_depth×W` 个 supertree nodes。论文默认 `K=64`、16 depths、pruned variant `W=12`，即每层 candidate score matrix 至多 `[12,64]`，而非全词表树扩展。

### 延迟剪枝为什么仍得到 prefix tree

完整 supertree 物化后，对所有节点一次 global top-B_node。因为 `log q≤0` 且 depth bonus `β≤0`，child score 不会高于 parent；tie 时 ancestors 优先，则 top-B_node 自动 prefix-closed，并与在这个已物化 supertree 上运行 best-first heap 等价：

> $$T=\operatorname{TopB}_{u\in S}s_\beta(u).$$

近似发生在前面的固定层宽：未进入 top-W 的路径永远不会物化；延迟 top-B 对“已物化 supertree”本身是等价选择。final tree 编译 ancestor visibility、depth position ids 后由 target 一次验证。

### Fixed 与 pruned 两种 variant

- `DARTree fixed`：验证预算 64 均分到 16 depths，每层直接保留 4 nodes，不再从更宽 supertree 剪枝。
- `DARTree pruned`：每层保留 12 nodes，最后用 `B_node=64`、`β=-0.2` 剪枝。宽 supertree 增加路径覆盖，target 仍只看 64-node tree。

### 代码对照

- `agentWorkSpace/20260823_dartree_reproduction/upstream/eval_dartree.py`：`build_dartree_supertree()` 执行 `[W,K]` batched correction/score/select；`select_topb_prefix_tree()` 延迟剪枝；`prepare_tree_attention_inputs()` 生成 target 输入；`follow_verified_tree()` 提交接受路径。
- `agentWorkSpace/20260823_dartree_reproduction/upstream/utils/draft_model.py`：共享 DFlash backbone、Domino GRU state 与 low-rank correction。
- CUDA Graph 只 capture 固定 shape 的 score/select 和 correction 子计算；depth loop、最终树控制流仍在 graph 外，不能写成“整轮完全 CUDA Graph”。

## 阅读顺序与证据口径

建议先读 DFlash 的 `[N,B,H]→[N,B,V]` 一次并行 block，再比较 Domino/DSpark 的逐 token low-rank correction 与 xPress 的 Jacobi block refinement；树方向从 DDTree 的 factorized prefix mass，过渡到 DominoTree 的 exact best-first conditional state，再到 DARTree 的 depth-wise batched approximation。公式来自对应版本论文，代码描述优先核对官方仓库或本仓库保存的官方快照；没有公开源码的 xPress 已单独标明，未把论文设计写成已验证实现。
