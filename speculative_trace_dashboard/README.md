# Speculative trace dashboard collection

该目录集中保存 speculative decoding 的原始 trace 和离线 dashboard，不再放入任何单一算法的论文复现实验目录。

## 命名规则

模型—数据集容器统一命名为：

```text
<target-model>-<dataset>_trace_dashboard/
```

容器内的单算法 trace 目录统一命名为：

```text
<target-model>-<dataset>-<algorithm>_trace_dashboard/
```

算法后缀用于区分同一个 target/dataset 下不同 drafter。以后增加模型或数据集时，在集合目录下增加一个新的同级模型—数据集容器。

## 当前产物

```text
agentWorkSpace/speculative_trace_dashboard/
  manifest.json
  README.md
  Qwen3-8B-gsm8k_trace_dashboard/
    Qwen3-8B-gsm8k_trace_dashboard.html
    Qwen3-8B-gsm8k-{dflash,dspark,eagle3}_trace_dashboard/
  Qwen3-8B-math500_trace_dashboard/
    Qwen3-8B-math500_trace_dashboard.html
    Qwen3-8B-math500-{dflash,dspark,eagle3}_trace_dashboard/
  Qwen3-8B-{aime25,humaneval,mbpp,livecodebench,mt-bench,alpaca,arena-hard-v2}_trace_dashboard/
    Qwen3-8B-<dataset>_trace_dashboard.html
    Qwen3-8B-<dataset>-{dflash,dspark,eagle3}_trace_dashboard/
```

九个数据集、27 组 trace 统一使用：

- target：`/state/partition/model/Qwen3-8B`；
- dataset：DSpark Table 1 九个数据集各自真实 sample 0；
- prompt：GSM8K/MATH-500 使用冻结的 `tools/trace/*_sample_000.jsonl`，其余七组直接读取
  `implementations/DeepSpec/eval_datasets/<dataset>.jsonl` 的第 0 行；
- `max_new_tokens=2048`；
- `temperature=0.0`，`seed=42`；
- Qwen3 thinking mode 关闭；
- target model 的 fast tokenizer。

`2048` 是生成上限，不要求一定生成 2048 tokens。27 个 run 均在上限前遇到 EOS。
正式 DSpark Table 1 实验使用 `temperature=1.0`；这里改用 greedy 是为了让三个官方实现
的 step-level 行为可重复查看，因此单样本 dashboard 指标不替代正式 T=1 聚合结果。
MT-Bench 数据本身有两轮，DeepSpec Table 1 loader 只取 `turns[0]`，trace 与该口径一致。

## 新增七个数据集的采集命令

从仓库根目录执行以下循环。它会覆盖同名 trace 目录中的 `run.json` 和 `steps.jsonl`：

```bash
set -e
datasets=(aime25 humaneval mbpp livecodebench mt-bench alpaca arena-hard-v2)
for dataset in "${datasets[@]}"; do
  prompt="implementations/DeepSpec/eval_datasets/${dataset}.jsonl"
  container="agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-${dataset}_trace_dashboard"

  /state/partition/model/.envs/dflash_repro/bin/python tools/trace/run_dflash_trace.py \
    --target /state/partition/model/Qwen3-8B \
    --draft /state/partition/model/drafters/Qwen3-8B-DFlash-b16 \
    --prompt-jsonl "$prompt" --sample-index 0 \
    --max-new-tokens 2048 --temperature 0.0 --seed 42 \
    --attention flash_attention_2 \
    --output "${container}/Qwen3-8B-${dataset}-dflash_trace_dashboard"

  /home/ylhuang/dLLMSpec/spec_dflash_env/bin/python tools/trace/run_deepspec_trace.py \
    --target /state/partition/model/Qwen3-8B \
    --draft /state/partition/model/drafters/dspark_qwen3_8b_block7 \
    --prompt-jsonl "$prompt" --sample-index 0 \
    --max-new-tokens 2048 --temperature 0.0 --confidence-threshold 0.0 --seed 42 \
    --output "${container}/Qwen3-8B-${dataset}-dspark_trace_dashboard"

  /state/partition/model/.envs/eagle3_repro/bin/python tools/trace/run_eagle_trace.py \
    --target /state/partition/model/Qwen3-8B \
    --draft /state/partition/model/drafters/qwen3_8b_eagle3_official \
    --prompt-jsonl "$prompt" --sample-index 0 \
    --max-new-tokens 2048 --temperature 0.0 --seed 42 \
    --total-token 32 --depth 8 --top-k 4 \
    --output "${container}/Qwen3-8B-${dataset}-eagle3_trace_dashboard"
done
```

## 运行结果

### Draft 模型信息

| Algorithm | Architecture | Draft layers | Checkpoint parameters | Checkpoint size |
|---|---|---:|---:|---:|
| DFlash | `DFlashDraftModel` | 5 | 1.049B | 1.95 GiB |
| DSpark | `Qwen3DSparkModel` | 5 | 2.371B | 4.42 GiB |
| EAGLE-3 | `LlamaForCausalLMEagle3` | 1 | 399.708M | 762.5 MiB |

参数量来自 checkpoint 中实际序列化 tensor。三种 checkpoint 的权重共享约定不同：
DFlash 在官方推理中复用 target input embedding 和 `lm_head`，DSpark checkpoint 则保存
这两张矩阵各自的副本，因此该参数量适合说明实际加载内容，不应单独用来推断速度。

DSpark 的 `2.371B / 4.42 GiB` 在 dashboard 汇总页进一步拆成：

| DSpark checkpoint component | Parameters | BF16 tensor payload | 说明 |
|---|---:|---:|---|
| Draft backbone and projections | 1,048,626,432 | 1.95 GiB | 与 DFlash checkpoint 的 5 层 backbone、feature projection 和 norms 总量相同 |
| Input embedding | 622,329,856 | 1.16 GiB | 从 target 复制并在训练时冻结；仍独立保存在 draft checkpoint |
| LM head | 622,329,856 | 1.16 GiB | 从 target 复制并在训练时冻结；仍独立保存在 draft checkpoint |
| Markov head | 77,791,232 | 148 MiB | DSpark 的低秩顺序 token 依赖模块 |
| Confidence head | 4,353 | 8.50 KiB | 可选 early-stop 的 acceptance predictor |

所以 DSpark 的算法核心（backbone、Markov 和 confidence）约为 `1.126B`；完整官方
checkpoint 的 `2.371B` 还包括两份 target 权重副本。官方 evaluator 会同时加载 target 和
完整 DSpark checkpoint，这些副本也构成实际显存开销。汇总页用黄色 `target copy` 标记
这两行，并同时显示参数量、tensor payload、占 checkpoint 比例和组件作用。

### GSM8K sample 0

| Algorithm | Verify steps | Reconstructed tokens | Accepted / proposed | Avg acceptance length |
|---|---:|---:|---:|---:|
| DFlash | 62 | 330 | 267 / 930 | 5.306 |
| DSpark | 54 | 330 | 276 / 378 | 6.093 |
| EAGLE-3 | 69 | 296 | 228 / 309 | 4.304 |

最终答案均为 `\boxed{18}`。

### MATH-500 sample 0

| Algorithm | Verify steps | Reconstructed tokens | Accepted / proposed | Avg acceptance length |
|---|---:|---:|---:|---:|
| DFlash | 45 | 273 | 227 / 675 | 6.044 |
| DSpark | 42 | 273 | 231 / 294 | 6.476 |
| EAGLE-3 | 76 | 273 | 198 / 295 | 3.605 |

三条生成文本完全一致，最终答案均为 `\boxed{\left(3, \frac{\pi}{2}\right)}`。

### 其余七个 Table 1 数据集 sample 0

单元格依次为 `verify rounds / reconstructed tokens through EOS / avg acceptance length`：

| Dataset | DFlash | DSpark | EAGLE-3 |
|---|---:|---:|---:|
| AIME25 | 100 / 778 / 7.790 | 134 / 852 / 6.351 | 220 / 884 / 4.023 |
| HumanEval | 85 / 511 / 6.024 | 88 / 512 / 5.807 | 95 / 446 / 4.705 |
| MBPP | 40 / 235 / 5.900 | 65 / 332 / 5.092 | 75 / 302 / 4.040 |
| LiveCodeBench | 11 / 73 / 6.727 | 13 / 73 / 5.538 | 22 / 73 / 3.409 |
| MT-Bench | 413 / 885 / 2.140 | 312 / 942 / 3.016 | 289 / 1001 / 3.467 |
| Alpaca | 46 / 151 / 3.304 | 25 / 147 / 5.840 | 22 / 139 / 6.364 |
| Arena-Hard-v2 | 253 / 951 / 3.763 | 208 / 758 / 3.639 | 252 / 790 / 3.147 |

同为 greedy 并不保证三个上游实现逐 token 输出一致：它们的 proposal/verification
实现、EOS 处理和 sampling 路径不同。LiveCodeBench sample 0 三者均重建 73 tokens；
其余新数据集存在不同长度的生成结果。这里应观察每条 trace 自身的数据流，不应把不同
输出长度下的单样本 `avg acceptance length` 直接解释成算法总体排名。

不同算法的 proposal 结构和接受语义不同，表中的比例适合观察单次过程，不应直接当作论文吞吐对比。

`Avg acceptance length` 定义为本 trace 实际提交 token 总数除以 verify rounds，包含每轮
存在的 target bonus/residual；终止于 draft EOS 的最后一轮不会虚构 bonus token。

## Dashboard 页面

三算法合并 HTML 默认打开 `Comparison overview` 汇总页，包括：

- 三个 drafter 的 architecture、层数、checkpoint 参数量和大小；
- draft checkpoint 组件拆分；DSpark 的 input embedding 与 LM head target 副本特别标色；
- verify rounds、平均 proposal、平均 accepted draft、平均 acceptance length；
- draft-token acceptance rate、最终生成长度和每轮接受长度分布；
- DFlash 并行 masked block、DSpark Markov 顺序修正、EAGLE-3 candidate tree 的数据流差异。

点击方法卡片或汇总表行会进入相应算法的 `Step explorer`。单算法 HTML 直接进入
`Step explorer`，左栏新增 Draft model、Checkpoint composition、Observed trace、Target
model 和 Run configuration 信息。模型信息在构建时从 `run.json` 和本地 checkpoint
config/weight header 合并，随后内嵌进 HTML。拖动 step 滑块、使用前后按钮或点击
`Acceptance timeline` 中的 step 时，timeline 会自动横向滚动，确保当前 step 留在可视区域；
`Generation stream` 则继续自动滚动到当前累计生成内容的底部。

## HTML 是否依赖 JSON

不依赖，准确地说是“构建时依赖，打开时不依赖”：

1. `tools/trace/build_dashboard.py` 构建时读取 `run.json` 和 `steps.jsonl`；
2. builder 计算 trace 汇总指标并读取模型元数据，再把所有数据写入 HTML 内的
   `traceData` 和 `runData` JSON script blocks；
3. 浏览器打开 HTML 时不执行 `fetch()`，不再访问 trace 目录，也不需要 web server；
4. 因此可以只复制 `.html` 到另一台机器离线查看；
5. 修改 JSON 后，已有 HTML 不会自动变化，必须重新运行 builder；
6. 删除 JSON 不影响已有 HTML，但会失去原始数据和重新构建能力。

九个汇总 HTML 都不含 `fetch()` 或 XHR。七个新增汇总页分别内嵌 AIME25 454、
HumanEval 268、MBPP 180、LiveCodeBench 46、MT-Bench 1,014、Alpaca 93 和
Arena-Hard-v2 713 个 events。

## 重新生成所有 HTML

从仓库根目录 `/home/ylhuang/dLLMSpec` 执行：

```bash
python tools/trace/build_dashboard.py \
  --trace-root agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k-dflash_trace_dashboard \
  --output agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k-dflash_trace_dashboard/Qwen3-8B-gsm8k-dflash_trace_dashboard.html \
  --title 'Qwen3-8B GSM8K DFlash Trace Dashboard'

python tools/trace/build_dashboard.py \
  --trace-root agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k-dspark_trace_dashboard \
  --output agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k-dspark_trace_dashboard/Qwen3-8B-gsm8k-dspark_trace_dashboard.html \
  --title 'Qwen3-8B GSM8K DSpark Trace Dashboard'

python tools/trace/build_dashboard.py \
  --trace-root agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k-eagle3_trace_dashboard \
  --output agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k-eagle3_trace_dashboard/Qwen3-8B-gsm8k-eagle3_trace_dashboard.html \
  --title 'Qwen3-8B GSM8K EAGLE-3 Trace Dashboard'

python tools/trace/build_dashboard.py \
  --trace-root agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard \
  --output agentWorkSpace/speculative_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard/Qwen3-8B-gsm8k_trace_dashboard.html \
  --title 'Qwen3-8B GSM8K Speculative Decoding Trace Dashboard'
```

其他数据集使用相同四条 builder 命令，只需替换路径和标题中的 dataset。重新生成集合
manifest：

```bash
python tools/trace/build_collection_manifest.py \
  --trace-root agentWorkSpace/speculative_trace_dashboard \
  --output agentWorkSpace/speculative_trace_dashboard/manifest.json
```

完整运行命令、tokenizer 校验、trace schema 和验证记录见
`docs/20260811_speculative_trace_dashboard_implementation.md`。
