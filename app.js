const papers = [
  {
    id: "eagle3",
    name: "EAGLE-3",
    date: "2025-03-03",
    title: "Scaling up Inference Acceleration of Large Language Models via Training-Time Test",
    color: "#236e8e",
    asset: "assets/eagle3_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/eagle3_table1.png", summary: "不同 target、任务和温度下的 speedup 与平均接受长度，建立 EAGLE-3 相对 EAGLE-2 等基线的主结论。" },
      { id: "method", label: "Figure 5 · 方法", src: "assets/eagle3_method.png", summary: "三步 draft pipeline：融合 target 的低、中、高层特征，再逐步扩展并交给 target tree verification。" },
      { id: "scaling-speed", label: "Figure 1a · 数据扩展", src: "assets/eagle3_scaling_speedup.svg", summary: "扩大训练数据后 EAGLE-3 speedup 持续增长，用来说明取消 feature constraint 与多层融合带来的 scaling 能力。" },
      { id: "scaling-tau", label: "Figure 1b · 接受长度", src: "assets/eagle3_scaling_tau.svg", summary: "与左图配套展示训练数据规模对接受长度的影响，验证吞吐提升来自 draft quality 的持续改善。" },
      { id: "tables2-4", label: "Tables 2–4 · 消融/Serving", src: "assets/eagle3_tables2_4.png", summary: "同页包含架构消融，以及 H100 上不同 batch size 的 SGLang throughput 和 batch=1 吞吐，用来连接算法改动与服务收益。" }
    ],
    kind: "自回归 draft · 多层特征融合 · tree verify",
    summary: "取消显式 feature prediction 约束，融合 target 低、中、高层特征并直接预测 token；沿用 EAGLE-2 的 draft tree 并行验证。",
    models: "Vicuna-13B、LLaMA-3.1-8B、LLaMA-3.3-70B、DeepSeek-R1-Distill-LLaMA-8B",
    datasets: "MT-Bench、HumanEval、GSM8K、Alpaca、CNN/DailyMail",
    metrics: "speedup、平均接受长度 τ、SGLang throughput",
    baselines: ["AR", "SpS", "PLD", "Medusa", "Hydra", "EAGLE", "EAGLE-2"],
    inherited: "EAGLE / EAGLE-2",
    reproduced: true,
    local: "LLaMA-3.1-8B MT-Bench 80 题：本地 A100 4.3356× / τ=6.1917；论文 4.40× / τ=6.13。",
    reproduction: {
      summary: "单张 A100 40GB、FP16、batch=1、tree budget 60；完整 MT-Bench 80 题通过。",
      sections: [
        { title: "EAGLE-3 完整 MT-Bench", headers: ["范围", "本地 speedup", "论文 speedup", "本地 τ", "论文 τ", "偏差"], rows: [["80 题 / 20 turns", "4.3356×", "4.40×", "6.1917", "6.13", "−1.46% / +1.01%"]] }
      ]
    },
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/EAGLE-3_2503.01840v3.pdf",
    arxiv: "https://arxiv.org/abs/2503.01840",
    repo: "https://github.com/SafeAILab/EAGLE",
    report: "../../agentWorkSpace/20260809_171833_eagle3_reproduction/README.md"
  },
  {
    id: "dflash",
    name: "DFlash",
    date: "2026-02-05",
    title: "Block Diffusion for Flash Speculative Decoding",
    color: "#c15b43",
    asset: "assets/dflash_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/dflash_table1.png", summary: "Qwen3-4B/8B 上 DFlash block16 与 EAGLE-3 tree16/tree60 的 speedup、τ 主结果。" },
      { id: "method", label: "Figure 2 · 方法", src: "assets/dflash_method.svg", summary: "target 多层 hidden features 被融合后注入每个 draft layer 的 KV cache，一次 forward 并行提出整个 block。" },
      { id: "draft-cost", label: "Figure 3 · Draft 成本", src: "assets/dflash_draft_cost.svg", summary: "比较 1/3/5 层 DFlash 与单层 EAGLE-3 的 draft latency，说明更深并行 drafter 的成本边界。" },
      { id: "tables2-4", label: "Tables 2–4 · Thinking/Serving/长上下文", src: "assets/dflash_tables2_4.png", summary: "覆盖 thinking 模式、SGLang FA4 高并发吞吐，以及 Qwen3.5-27B 长上下文适配，是论文部署实验的核心。" },
      { id: "tables5-9", label: "Tables 5–9 · 跨框架与消融", src: "assets/dflash_tables5_9.png", summary: "覆盖 LLaMA/SGLang 迁移、draft 层数、target feature 数量、训练/推理 block mismatch 与 feature conditioning 消融。" },
      { id: "tables10-12", label: "Tables 10–12 · 泛化/vLLM", src: "assets/dflash_tables11_12.png", summary: "无 target feature 对照、更多 target 模型迁移，以及 Qwen3.5-9B 在 vLLM 下的吞吐，补足跨模型与跨 serving engine 证据。" },
      { id: "table13", label: "Table 13 · Anchor 采样", src: "assets/dflash_table13.png", summary: "对比固定与随机 anchor 采样，验证训练数据增强能提高接受长度与最终 speedup。" }
    ],
    kind: "block diffusion · one-shot parallel draft",
    summary: "轻量 block-diffusion drafter 一次 forward 并行提出完整 block，并将 target 多层 hidden features 注入每层 KV cache。",
    models: "Qwen3-4B/8B、Qwen3-Coder-30B-A3B、LLaMA-3.1-8B",
    datasets: "7 个 math / code / chat 任务；另含 thinking、长上下文与 serving",
    metrics: "speedup、τ、tok/s、高并发 throughput",
    baselines: ["AR", "EAGLE-3 tree16", "EAGLE-3 tree60"],
    inherited: "核心对比 EAGLE-3",
    reproduced: true,
    local: "Table 1 共 84/84 点完成；Table 3 风格 Spec-v2 speculative 矩阵 40/40 点完成。DFlash/EAGLE-3 同口径吞吐比几何平均 2.917×；旧 baseline 不用于 speedup。",
    reproduction: {
      summary: "包含 Table 1 聚合复现与 A100 Table 3 风格 Spec-v2 高并发明细。Table 3 的 baseline 是旧 non-overlap，仅展示 DFlash/EAGLE-3 同口径比较。",
      warning: "口径限制：DFlash/EAGLE-3 为 Spec-v2 overlap；20 个 baseline 为 legacy non-overlap，不得据此计算正式 speedup。",
      sections: [
        { title: "Table 1 · 跨模型/温度聚合", headers: ["方法", "预算", "点数", "A100 speedup 几何平均", "论文 H200", "A100 τ", "论文 τ"], rows: [
          ["DFlash", "block16", "28", "4.62×", "4.49×", "6.12", "6.05"],
          ["EAGLE-3", "tree16", "28", "2.19×", "1.74×", "2.99", "2.95"],
          ["EAGLE-3", "tree60", "28", "2.48×", "1.97×", "3.44", "3.38"]
        ] },
        { title: "Table 3 风格 · Spec-v2 overlap 明细", headers: ["模型", "数据集", "c", "DFlash tok/s", "DFlash τ", "EAGLE-3 tok/s", "EAGLE-3 τ", "吞吐比"], rows: [
          ["4B", "HumanEval", "1", "611.58", "6.629", "204.56", "3.099", "2.990×"],
          ["4B", "HumanEval", "4", "1988.51", "6.574", "689.75", "3.093", "2.883×"],
          ["4B", "HumanEval", "8", "3245.54", "6.568", "1159.88", "3.109", "2.798×"],
          ["4B", "HumanEval", "16", "4214.02", "6.607", "1565.62", "3.093", "2.692×"],
          ["4B", "HumanEval", "32", "4965.04", "6.584", "1760.91", "3.101", "2.820×"],
          ["4B", "Math500", "1", "734.74", "8.001", "206.86", "3.150", "3.552×"],
          ["4B", "Math500", "4", "2446.51", "8.001", "707.48", "3.150", "3.458×"],
          ["4B", "Math500", "8", "3991.32", "8.005", "1169.94", "3.152", "3.412×"],
          ["4B", "Math500", "16", "5055.65", "8.001", "1561.71", "3.146", "3.237×"],
          ["4B", "Math500", "32", "5786.08", "7.987", "1731.53", "3.149", "3.342×"],
          ["8B", "HumanEval", "1", "397.64", "6.499", "156.88", "3.232", "2.535×"],
          ["8B", "HumanEval", "4", "1394.09", "6.576", "542.96", "3.233", "2.568×"],
          ["8B", "HumanEval", "8", "2226.66", "6.513", "906.28", "3.225", "2.457×"],
          ["8B", "HumanEval", "16", "2797.99", "6.524", "1194.60", "3.221", "2.342×"],
          ["8B", "HumanEval", "32", "3066.86", "6.495", "1327.41", "3.218", "2.310×"],
          ["8B", "Math500", "1", "489.37", "7.987", "154.27", "3.120", "3.172×"],
          ["8B", "Math500", "4", "1679.09", "7.970", "526.87", "3.111", "3.187×"],
          ["8B", "Math500", "8", "2748.92", "8.011", "880.61", "3.115", "3.122×"],
          ["8B", "Math500", "16", "3372.68", "7.982", "1144.85", "3.113", "2.946×"],
          ["8B", "Math500", "32", "3640.33", "8.024", "1219.15", "3.105", "2.986×"]
        ] },
        { title: "Table 3 风格 · 扩展与聚合", headers: ["模型 / 数据集", "DFlash/EAGLE-3 几何平均", "DFlash c32/c1", "EAGLE-3 c32/c1"], rows: [
          ["4B / HumanEval", "2.835×", "8.118×", "8.608×"],
          ["4B / Math500", "3.398×", "7.875×", "8.371×"],
          ["8B / HumanEval", "2.440×", "7.713×", "8.461×"],
          ["8B / Math500", "3.081×", "7.439×", "7.903×"]
        ] }
      ]
    },
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/DFlash_2602.06036v2.pdf",
    arxiv: "https://arxiv.org/abs/2602.06036",
    repo: "https://github.com/z-lab/dflash",
    report: "../../agentWorkSpace/20260817_183558_dflash_table3_specv1_eagle3_qwen3/FINAL_SPECV2_RESULTS.md"
  },
  {
    id: "ddtree",
    name: "DDTree",
    date: "2026-04-14",
    title: "Accelerating Speculative Decoding with Block Diffusion Draft Trees",
    color: "#6e5da8",
    asset: "assets/ddtree_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/ddtree_table1.png", summary: "跨模型、数据集与温度选择最佳 node budget 后的 speedup/τ，建立 DDTree 相对 DFlash 的主结果。" },
      { id: "method", label: "Figure 2 · 方法", src: "assets/ddtree_method.png", summary: "页面上方展示一次 block-diffusion forward 产生位置边缘分布，再以 best-first 方式选择验证树并由 target 沿树行走。" },
      { id: "budget", label: "Figure 3 · Budget trade-off", src: "assets/ddtree_budget_tradeoff.svg", summary: "budget 增大时 τ 持续上升，但 verifier 成本使 speedup 在中间预算达到峰值。" },
      { id: "distribution", label: "Figure 4 · 接受分布", src: "assets/ddtree_acceptance_histogram.svg", summary: "相对 DFlash，DDTree 把概率质量推向更长接受前缀，尤其增加完整 block 接受。" }
    ],
    kind: "marginal distributions · best-first draft tree",
    summary: "直接从 DFlash 各位置边缘分布用 best-first heap 选取 top-B 概率前缀，在不增加 drafter forward 的情况下构造验证树。",
    models: "Qwen3-4B、Qwen3-8B、Qwen3-Coder-30B-A3B",
    datasets: "10 个 math / code / instruction / dialogue 数据集",
    metrics: "speedup、τ、接受长度分布、budget tradeoff",
    baselines: ["AR", "DFlash"],
    inherited: "DFlash marginals",
    reproduced: false,
    local: "尚无官方 DDTree 本地正式复现；DSpark dynamic-tree 是不同实现，不能替代本论文结果。",
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/DDTree_Accelerating_Speculative_Decoding_with_Block_Diffusion_Draft_Trees_arXiv-2604.12989v1.pdf",
    arxiv: "https://arxiv.org/abs/2604.12989",
    repo: "https://github.com/liranringel/ddtree",
    report: ""
  },
  {
    id: "domino",
    name: "Domino",
    date: "2026-05-28",
    title: "Decoupling Causal Modeling from Autoregressive Drafting in Speculative Decoding",
    color: "#287e73",
    asset: "assets/domino_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/domino_table1.png", summary: "Qwen3-4B/8B 的 speedup 与 τ，对比 AR、EAGLE-3、DFlash、DART、FR-Spec。" },
      { id: "method", label: "Figure 3 · 方法", src: "assets/domino_method.png", summary: "并行 backbone 一次生成 block hidden states，轻量 GRU 头再按 token 顺序产生 causal correction logits。" },
      { id: "latency", label: "Figure 1 · 延迟拆解", src: "assets/domino_latency_breakdown.svg", summary: "拆分 verify、draft、LM head、Domino head 与 tree 成本，并展示接受长度和端到端收益。" },
      { id: "table2", label: "Table 2 · 高并发", src: "assets/domino_table2.png", summary: "同页右下为 Qwen3-4B/8B concurrency 2–32 的 TPS 与相对 baseline speedup，展示服务负载下的收益。" },
      { id: "curriculum", label: "Figure 4 · 训练消融", src: "assets/domino_curriculum_ablation.png", summary: "比较 TTT、teacher forcing 与 base-anchored curriculum，说明训练策略如何降低 loss 并提高 τ。" },
      { id: "tables3-4", label: "Tables 3–4 · 同数据/Head 消融", src: "assets/domino_tables3_4.png", summary: "同训练数据比较隔离方法差异，并通过开关 Domino head 验证 causal correction 的独立贡献。" }
    ],
    kind: "parallel backbone · GRU causal correction",
    summary: "保留 DFlash 式并行 backbone，再用轻量 GRU 沿已生成 token 顺序修正 logits，以较低成本恢复块内因果依赖。",
    models: "Qwen3-4B、Qwen3-8B",
    datasets: "8 个 math / code / chat 数据集",
    metrics: "speedup、τ、SGLang concurrency 2–32 TPS",
    baselines: ["AR", "EAGLE-3", "DFlash", "DART", "FR-Spec"],
    inherited: "DFlash-style backbone",
    reproduced: false,
    local: "仓库已收录论文与官方代码，尚无正式本地复现。",
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/Domino_Decoupling_Causal_Modeling_from_Autoregressive_Drafting_in_Speculative_Decoding_arXiv-2605.29707v1.pdf",
    arxiv: "https://arxiv.org/abs/2605.29707",
    repo: "https://github.com/jianuo-huang/Domino",
    report: ""
  },
  {
    id: "dspark",
    name: "DSpark",
    date: "2026-07-06",
    title: "Confidence-Scheduled Speculative Decoding with Semi-Autoregressive Generation",
    color: "#a56f28",
    asset: "assets/dspark_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/dspark_table1.png", summary: "多 target、多领域的接受长度主表，核心对比 EAGLE-3、DFlash 与 DSpark。" },
      { id: "method", label: "Figure 1 · 方法", src: "assets/dspark_method.svg", summary: "并行 backbone 与轻量 sequential head 共同 proposal，同时输出 confidence 供硬件感知前缀调度器动态裁剪。" },
      { id: "proposal", label: "Figure 4 · Proposal/延迟", src: "assets/dspark_proposal_latency.svg", summary: "扫描 proposal length，并显示 sequential head 的额外 serving latency 很小。" },
      { id: "calibration", label: "Figure 6 · 置信校准", src: "assets/dspark_calibration.svg", summary: "raw confidence 有过度自信，post-hoc calibration 将预测 survival probability 与经验接受率对齐。" },
      { id: "load", label: "Figure 8 · 负载自适应", src: "assets/dspark_load_adaptive.png", summary: "并发升高时 scheduler 自动缩小 verification budget，在吞吐与单请求 TPS 约束间调整。" }
    ],
    kind: "Markov/RNN head · confidence scheduling",
    summary: "并行 backbone 加 sequential Markov/RNN head 提升 chain 质量，并用校准 confidence 在并发升高时动态收缩 verification budget。",
    models: "Qwen3-4B/8B/14B、Gemma-3-12B；生产 DeepSeek-V4",
    datasets: "9 个 math / code / chat 数据集与真实线上流量",
    metrics: "accept_len、confidence calibration、engine latency、throughput–TPS frontier",
    baselines: ["EAGLE-3", "DFlash", "MTP-1"],
    inherited: "DFlash backbone；对比 EAGLE-3",
    reproduced: true,
    local: "Qwen3-8B acceptance 4.814678（论文 4.813333，+0.028%）；14B 4.7644（论文 4.7789，−0.30%）。14B 单并发 DSpark 3.007×，仅作本机 variant 比较。",
    reproduction: {
      summary: "Qwen3-8B 与 14B 均完成九数据集 acceptance-length 复现；14B 另有同机单并发吞吐，但只有单 trial。",
      sections: [
        { title: "Qwen3-8B · Table 1 acceptance", headers: ["数据集", "本地", "论文", "偏差"], rows: [
          ["GSM8K", "6.159041", "6.17", "−0.178%"], ["MATH500", "5.777560", "5.78", "−0.042%"], ["AIME25", "5.098821", "5.01", "+1.773%"], ["MBPP", "5.155242", "5.16", "−0.092%"], ["HumanEval", "5.454539", "5.52", "−1.186%"], ["LiveCodeBench", "5.150746", "5.17", "−0.372%"], ["MT-Bench", "3.668335", "3.72", "−1.389%"], ["Alpaca", "3.639451", "3.58", "+1.661%"], ["Arena-Hard-v2", "3.228372", "3.21", "+0.572%"], ["Macro", "4.814678", "4.813333", "+0.028%"]
        ] },
        { title: "Qwen3-14B · Table 1 acceptance", headers: ["数据集", "DFlash", "DSpark", "论文 DSpark", "相对论文"], rows: [
          ["GSM8K", "5.3841", "6.1663", "6.21", "−0.70%"], ["MATH500", "4.8710", "5.7523", "5.74", "+0.21%"], ["AIME25", "4.1006", "4.9482", "4.94", "+0.17%"], ["HumanEval", "4.5643", "5.3825", "5.43", "−0.87%"], ["MBPP", "4.4324", "5.2395", "5.26", "−0.39%"], ["LiveCodeBench", "4.3881", "5.0650", "5.02", "+0.90%"], ["MT-Bench", "3.0696", "3.6353", "3.70", "−1.75%"], ["Alpaca", "2.9658", "3.5496", "3.58", "−0.85%"], ["Arena-Hard-v2", "2.7244", "3.1413", "3.13", "+0.36%"], ["Macro", "4.0556", "4.7644", "4.7789", "−0.30%"]
        ] },
        { title: "Qwen3-14B · 单并发本机吞吐", headers: ["Variant", "请求", "tok/s", "相对 vanilla", "平均延迟"], rows: [["vanilla", "3030", "49.97", "1.000×", "10.968s"], ["DFlash", "3030", "141.49", "2.832×", "3.855s"], ["DSpark", "3030", "150.23", "3.007×", "3.646s"]] }
      ]
    },
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/DSpark_paper.pdf",
    arxiv: "https://arxiv.org/abs/2607.05147",
    repo: "https://github.com/deepseek-ai/DeepSpec",
    report: "../../agentWorkSpace/20260811_174925_dspark_qwen3_8b_official_reproduction/FINAL_ACCEPTANCE_REPORT.md"
  },
  {
    id: "dominotree",
    name: "DominoTree",
    date: "2026-07-09",
    title: "Conditional Tree-Structured Drafting with Domino for Speculative Decoding",
    color: "#79578d",
    asset: "assets/dominotree_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/dominotree_table1.png", summary: "跨两个模型、八数据集与温度的 speedup/τ；论文特别区分不同 harness 各自的 AR 归一化。" },
      { id: "comparison", label: "Figure 1 · 总体比较", src: "assets/dominotree_main_comparison.svg", summary: "Qwen3-4B 八数据集上同时比较 DFlash、DDTree、CaDDTree、Domino 与 DominoTree 的 τ 和 speedup。" },
      { id: "table2", label: "Table 2 · Bootstrap TPS", src: "assets/dominotree_table2.png", summary: "paired bootstrap 给出相对各 baseline 的 throughput 差值与 95% CI，处理同/跨 harness 比较。" },
      { id: "tables3-4", label: "Tables 3–4 · GPU Builder", src: "assets/dominotree_tables3_4.png", summary: "验证 Python 与 GPU-native builder 构树完全一致，并量化 GPU builder 只降低 build stage 的成本。" },
      { id: "tables5-6", label: "Tables 5–6 · Conditioning/无损", src: "assets/dominotree_tables5_6.png", summary: "匹配 budget 比较 conditional 与 marginal tree，同时检查 BF16 tie-breaking 下与 AR 的无损一致性。" },
      { id: "tables7-8", label: "Tables 7–8 · Budget/候选宽度", src: "assets/dominotree_tables7_8.png", summary: "扫描 node budget 与 candidate width，展示接受长度收益、build 成本和 throughput 的折中。" }
    ],
    kind: "path-conditional tree · GPU-native builder",
    summary: "将 Domino 的 GRU correction 沿每条树路径参与评分，把 DDTree 的 marginal tree 升级为 path-conditional tree。",
    models: "Qwen3-4B、Qwen3-8B",
    datasets: "Domino 的 8 个 math / code / chat 数据集",
    metrics: "speedup、τ、paired-bootstrap TPS、builder latency",
    baselines: ["AR", "DFlash", "DDTree", "CaDDTree", "Domino"],
    inherited: "DDTree tree builder + Domino correction",
    reproduced: false,
    local: "尚无 DominoTree 官方 harness 的本地正式复现。复现时需保留不同 harness 各自的 AR 归一化口径。",
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/DominoTree_Conditional_Tree-Structured_Drafting_with_Domino_for_Speculative_Decoding_arXiv-2607.08642v2.pdf",
    arxiv: "https://arxiv.org/abs/2607.08642",
    repo: "https://github.com/slin-zhq/Domino-Tree",
    report: ""
  },
  {
    id: "xpress",
    name: "xPress",
    date: "2026-08-03",
    title: "Parallel Refinement for Diffusion Drafters in Speculative Decoding",
    color: "#1d778a",
    asset: "assets/xpress_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/xpress_table1.png", summary: "Qwen3-8B、DFlash block16 下，greedy 与 lossless sampling 的 speedup/τ，并报告相对 plain DFlash 的增益。" },
      { id: "method", label: "Figure 2 · 方法", src: "assets/xpress_method.svg", summary: "block drafter 后接低秩 causal refiner，以若干次并行 Jacobi pass 更新整个 block 的 logits bias。" },
      { id: "table2", label: "Table 2 · vLLM Serving", src: "assets/xpress_table2.png", summary: "vLLM + FA3 下不同 batch size 的吞吐和相对 AR speedup，用于验证 refiner 在 serving engine 中的收益。" },
      { id: "iterations", label: "Figure 3 · Jacobi 次数", src: "assets/xpress_jacobi_iterations.svg", summary: "τ 随 Jacobi iteration 快速上升，少数 pass 即超过 sequential Markov head，之后进入平台。" },
      { id: "table3", label: "Table 3 · Refiner 延迟", src: "assets/xpress_table3.png", summary: "比较 K 次并行 Jacobi 与 15-step sequential Markov head 的每 block 延迟，解释并行 refinement 的系统优势。" }
    ],
    kind: "causal refiner · parallel Jacobi passes",
    summary: "用小型 causal refiner 对整个 block 做若干次并行 Jacobi 更新，在恢复因果依赖的同时避免逐 token correction loop。",
    models: "Qwen3-8B + DFlash block-16",
    datasets: "7 个 math / code / chat 数据集",
    metrics: "speedup、τ、refinement latency、vLLM batch throughput",
    baselines: ["AR", "DFlash", "DSpark-style Markov head"],
    inherited: "DFlash backbone；对比 DSpark head",
    reproduced: false,
    local: "当前没有正式本地复现，也尚未确认官方开源实现。",
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/xPress_Parallel_Refinement_for_Diffusion_Drafters_in_Speculative_Decoding_arXiv-2608.02438v1.pdf",
    arxiv: "https://arxiv.org/abs/2608.02438",
    repo: "",
    report: ""
  },
  {
    id: "dartree",
    name: "DARTree",
    date: "2026-08-13",
    title: "Speculative Diffusion Decoding with Autoregressive Draft Trees",
    color: "#b44f4d",
    asset: "assets/dartree_table1.png",
    figures: [
      { id: "table1", label: "Table 1 · 主结果", src: "assets/dartree_table1.png", summary: "Qwen3-4B/8B、两种温度下的 speedup/τ，比较 DFlash、DDTree、Domino 与 DARTree。" },
      { id: "method", label: "Figure 3 · 方法", src: "assets/dartree_method.svg", summary: "先 block-parallel draft，再按 depth 批量推进 AR correction state，最后做 deferred best-first pruning 和一次 tree verification。" },
      { id: "tables2-3", label: "Tables 2–3 · 构树/Head 消融", src: "assets/dartree_tables2_3.png", summary: "比较不同 tree construction，并在发布的 DSpark Markov head 上验证方法不依赖特定 correction head。" },
      { id: "width-budget", label: "Figure 4 · Width/Budget", src: "assets/dartree_width_budget.svg", summary: "扫描并行宽度 W 和 verification budget B，显示接受长度、round time 与 speedup 的敏感性。" },
      { id: "table4", label: "Table 4 · 并发 Serving", src: "assets/dartree_table4.png", summary: "SGLang、RTX 6000 Ada、concurrency 2–32 的 TPS/speedup，并对 DDTree/DARTree 使用负载自适应 budget。" }
    ],
    kind: "depth-wise batch expansion · deferred pruning",
    summary: "将预训练 AR correction head 扩展到多分支：同 depth 候选批量推进 correction state，最后再做简化 best-first pruning。",
    models: "Qwen3-4B、Qwen3-8B",
    datasets: "7 个 math / code / chat 数据集",
    metrics: "speedup、τ、round time、tree depth distribution",
    baselines: ["AR", "DFlash", "DDTree", "Domino"],
    inherited: "DFlash + DDTree + Domino correction head",
    reproduced: false,
    local: "尚无正式本地复现。本地 DSpark dynamic-tree 与其实现、预算和硬件均不同。",
    pdf: "https://github.com/mokomoko05/dLLMSpec/blob/main/papers/DARTree_Speculative_Diffusion_Decoding_with_Autoregressive_Draft_Trees_arXiv-2608.13524v1.pdf",
    arxiv: "https://arxiv.org/abs/2608.13524",
    repo: "https://github.com/VILA-Lab/DARTree",
    report: ""
  }
];

const positions = {
  eagle3: [28, 112],
  dflash: [28, 320],
  ddtree: [444, 50],
  domino: [444, 206],
  dspark: [444, 362],
  dominotree: [846, 50],
  xpress: [846, 206],
  dartree: [846, 362]
};

const relations = [
  ["eagle3", "dflash", "compare"],
  ["dflash", "ddtree", "inherit"],
  ["dflash", "domino", "inherit"],
  ["eagle3", "dspark", "compare"],
  ["dflash", "dspark", "inherit"],
  ["ddtree", "dominotree", "inherit"],
  ["domino", "dominotree", "inherit"],
  ["dflash", "xpress", "inherit"],
  ["dspark", "xpress", "compare"],
  ["dflash", "dartree", "inherit"],
  ["ddtree", "dartree", "inherit"],
  ["domino", "dartree", "inherit"]
];

const nodes = document.querySelector("#paper-nodes");
const edges = document.querySelector("#edge-layer");
const previewCopy = document.querySelector("#preview-copy");
const previewImage = document.querySelector("#preview-image");
const previewTitle = document.querySelector("#preview-title");
const openImage = document.querySelector("#open-image");
const previewTabs = document.querySelector("#preview-tabs");
const previewSummary = document.querySelector("#preview-summary");
const imageStage = document.querySelector("#image-stage");
const resultStage = document.querySelector("#result-stage");

let selectedPaper = null;

function incomingNames(id) {
  return relations
    .filter((relation) => relation[1] === id)
    .map((relation) => papers.find((paper) => paper.id === relation[0]).name);
}

function renderNodes() {
  nodes.innerHTML = papers.map((paper) => {
    const [left, top] = positions[paper.id];
    const incoming = incomingNames(paper.id);
    return `<button class="paper-node" id="node-${paper.id}" data-id="${paper.id}" type="button" style="left:${left}px;top:${top}px;--accent:${paper.color}" aria-label="查看 ${paper.name}">
      <span class="node-layout">
        <span class="node-thumb"><img src="${paper.asset}" alt="" loading="lazy"></span>
        <span class="node-copy">
          <span class="node-meta"><time datetime="${paper.date}">${paper.date.slice(0, 7)}</time><span class="node-status${paper.reproduced ? "" : " pending"}">${paper.reproduced ? "已复现" : "未复现"}</span></span>
          <h3>${paper.name}</h3>
          <span class="node-kind">${paper.kind}</span>
          <span class="node-inherits">${incoming.length ? `← ${incoming.join(" + ")}` : paper.inherited}</span>
        </span>
      </span>
    </button>`;
  }).join("");

  document.querySelectorAll(".paper-node").forEach((node) => {
    node.addEventListener("click", () => selectPaper(node.dataset.id, true));
    node.addEventListener("mouseenter", () => highlightEdges(node.dataset.id));
    node.addEventListener("mouseleave", clearEdges);
    node.addEventListener("focus", () => highlightEdges(node.dataset.id));
    node.addEventListener("blur", clearEdges);
  });
}

function renderEdges() {
  const canvas = document.querySelector("#graph-canvas");
  const canvasBox = canvas.getBoundingClientRect();
  edges.setAttribute("viewBox", `0 0 ${canvasBox.width} ${canvasBox.height}`);
  edges.innerHTML = `<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#9ba7b2"></path></marker></defs>` + relations.map(([from, to, type]) => {
    const source = document.querySelector(`#node-${from}`).getBoundingClientRect();
    const target = document.querySelector(`#node-${to}`).getBoundingClientRect();
    let x1 = source.right - canvasBox.left;
    let y1 = source.top - canvasBox.top + source.height / 2;
    let x2 = target.left - canvasBox.left;
    let y2 = target.top - canvasBox.top + target.height / 2;

    if (from === "eagle3" && to === "dflash") {
      x1 = source.left - canvasBox.left + source.width / 2;
      y1 = source.bottom - canvasBox.top;
      x2 = target.left - canvasBox.left + target.width / 2;
      y2 = target.top - canvasBox.top;
    }

    const bend = Math.max(38, Math.abs(x2 - x1) * 0.46);
    const path = from === "eagle3" && to === "dflash"
      ? `M ${x1} ${y1} C ${x1} ${y1 + 34}, ${x2} ${y2 - 34}, ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    return `<path class="edge-path ${type === "compare" ? "compare" : ""}" data-from="${from}" data-to="${to}" d="${path}" marker-end="url(#arrow)"></path>`;
  }).join("");
}

function highlightEdges(id) {
  edges.querySelectorAll(".edge-path").forEach((path) => {
    const active = path.dataset.from === id || path.dataset.to === id;
    path.classList.toggle("hot", active);
    path.classList.toggle("dim", !active);
  });
}

function clearEdges() {
  edges.querySelectorAll(".edge-path").forEach((path) => path.classList.remove("hot", "dim"));
}

function renderLinks(paper) {
  return [
    `<a href="${paper.pdf}">本地 PDF</a>`,
    `<a href="${paper.arxiv}">arXiv</a>`,
    paper.repo ? `<a href="${paper.repo}">官方 Repo</a>` : ""
  ].filter(Boolean).join("");
}

function artifactsFor(paper) {
  const artifacts = [...paper.figures];
  if (paper.reproduction) {
    artifacts.push({
      id: "local-reproduction",
      label: "本地复现结果",
      type: "results",
      summary: paper.reproduction.summary
    });
  }
  return artifacts;
}

function renderResultTables(reproduction) {
  const warning = reproduction.warning
    ? `<div class="result-warning">${reproduction.warning}</div>`
    : "";
  const sections = reproduction.sections.map((section) => `<section class="result-section">
    <h3>${section.title}</h3>
    <div class="result-table-wrap"><table class="result-table">
      <thead><tr>${section.headers.map((header) => `<th scope="col">${header}</th>`).join("")}</tr></thead>
      <tbody>${section.rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
    ${section.note ? `<p class="result-note">${section.note}</p>` : ""}
  </section>`).join("");
  return `<p class="result-intro">${reproduction.summary}</p>${warning}${sections}`;
}

function selectArtifact(index, focus = false) {
  const paper = papers.find((item) => item.id === selectedPaper);
  const artifacts = artifactsFor(paper);
  const artifact = artifacts[index];
  const tabs = [...previewTabs.querySelectorAll("[role=tab]")];

  tabs.forEach((tab, tabIndex) => {
    const active = tabIndex === index;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  if (focus) tabs[index].focus();

  previewTitle.textContent = `${paper.name} · ${artifact.label}`;
  previewSummary.textContent = artifact.summary;
  document.querySelector("#preview-content").setAttribute("aria-labelledby", tabs[index].id);
  if (artifact.type === "results") {
    imageStage.hidden = true;
    resultStage.hidden = false;
    resultStage.innerHTML = renderResultTables(paper.reproduction);
    openImage.hidden = true;
  } else {
    resultStage.hidden = true;
    imageStage.hidden = false;
    previewImage.src = artifact.src;
    previewImage.alt = `${paper.name} ${artifact.label}`;
    openImage.href = artifact.src;
    openImage.hidden = false;
  }
}

function renderArtifactTabs(paper) {
  const artifacts = artifactsFor(paper);
  previewTabs.innerHTML = artifacts.map((artifact, index) => `<button type="button" role="tab" id="tab-${paper.id}-${artifact.id}" aria-controls="preview-content" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-index="${index}">${artifact.label}</button>`).join("");
  previewTabs.querySelectorAll("[role=tab]").forEach((tab) => {
    tab.addEventListener("click", () => selectArtifact(Number(tab.dataset.index)));
    tab.addEventListener("keydown", (event) => {
      const count = artifacts.length;
      const current = Number(tab.dataset.index);
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % count;
      else if (event.key === "ArrowLeft") next = (current - 1 + count) % count;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = count - 1;
      else return;
      event.preventDefault();
      selectArtifact(next, true);
    });
  });
  selectArtifact(0);
}

function selectPaper(id, scroll) {
  const paper = papers.find((item) => item.id === id);
  selectedPaper = id;
  document.querySelectorAll(".paper-node").forEach((node) => node.classList.toggle("active", node.dataset.id === id));
  previewCopy.innerHTML = `<span class="preview-date">${paper.date} · ${paper.reproduced ? "本地已复现" : "本地未复现"}</span>
    <h2>${paper.name}</h2>
    <p class="preview-paper-title">${paper.title}</p>
    <div class="preview-section"><h3>方法</h3><p>${paper.summary}</p></div>
    <div class="preview-section"><h3>论文实验</h3><dl class="fact-list"><div><dt>模型</dt><dd>${paper.models}</dd></div><div><dt>数据</dt><dd>${paper.datasets}</dd></div><div><dt>指标</dt><dd>${paper.metrics}</dd></div></dl></div>
    <div class="preview-section"><h3>对比基线</h3><div class="chips">${paper.baselines.map((item) => `<span>${item}</span>`).join("")}</div></div>
    <div class="preview-section"><h3>本地结果</h3><div class="local-state${paper.reproduced ? "" : " pending"}">${paper.local}</div></div>
    <div class="preview-section preview-links">${renderLinks(paper)}</div>`;
  renderArtifactTabs(paper);
  highlightEdges(id);
  if (scroll && window.innerWidth < 800) document.querySelector("#preview").scrollIntoView({ behavior: "smooth", block: "start" });
}

renderNodes();
renderEdges();
selectPaper("dflash", false);

window.addEventListener("resize", renderEdges);
