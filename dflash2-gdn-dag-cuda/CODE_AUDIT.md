# DFlash2 Ours Tree：代码实现、Profile与E2E可靠性审查清单

> 更新时间：2026-09-19。本文行号固定对应vLLM `exp/noncompute-p0-p4@4ae600ad845a9bb5fe0998e17182856596faeabb`。正式多数据集runner代码对应dLLMSpec `exp/20260919_tree_report_multidataset128@60568a3de1cdfe210ff0b1e1f3dc6a0fdb830b49`；之后若只有文档提交，运行代码仍以该commit为准。

## 1. 当前测试状态

当前有效run：

```text
node: lengjingwen108-0
run: /root/.local/share/dLLMSpec/tree_multidataset128/20260919_152000
chain: GPU0, port 8401
tree:  GPU1, port 8402
```

截至2026-09-19 15:28 CST，两服务均health-ready，正在并行执行GSM8K前128条；随后依次运行MATH-500、HumanEval、MBPP和LiveCodeBench各128条。GPU0 placeholder在实验前已关闭；exclusive wrapper退出时恢复。

第一次启动`20260919_150000`只进入模型加载，尚未health-ready、没有warmup或正式请求。审查时发现launcher误写未被实现读取的`VLLM_DFLASH2_GDN_BACKEND=cuda`，正确变量应为`VLLM_DFLASH2_TREE_GDN_BACKEND=cuda`。该run已标记`INVALID_CONFIG_PRE_REQUEST`并永久排除；修复commit为`fc3241176015300e674c3c215741a09b4a3d6f8a`。

## 2. 建议diff口径

完整tree相对official chain：

```bash
cd /cephfs/shared/wmhu/vllm-0.26-gdn-dag-cuda
git diff cfefde6f82fcebbb34bf9428b9d25173762451cd..4ae600ad845a9bb5fe0998e17182856596faeabb
```

共35个文件，`+7493/-36`。`cfefde6`是DFlash2 official chain注册后的基准。

只看CPU tree correctness reference之后的CUDA性能重构：

```bash
git diff 24ea78c34f3775133bd97aafd32c13efefa110f1..4ae600ad845a9bb5fe0998e17182856596faeabb
```

共23个文件，`+6128/-26`。

## 3. 接受长度与建树

### 3.1 `vllm/v1/spec_decode/tree_builder.py`，L1–508

- L25–95：官方selector checkpoint结构、tensor key和权重shape校验。
- L99–143：`TreeConfig`、`TreeNode`、verification layout/result。
- L152–220：CPU verification与prefix重算reference。
- L222–284：`CandidateTree`、leaf path、parent/depth/ancestor layout。
- L286–311：`OfficialDFlash2TreeBuilder`入口。
- L312–403：protected 7-token trunk和stable best-first heap。
- L404–433：prefix-closed、重复token、branching/node budget检查。
- L434–508：official-model/vLLM边界。

算法先严格复现7步official selector argmax walk，再以累计log path probability扩展；trunk永不裁剪，`max_nodes=21`、每parent最多2个不同token child。

### 3.2 `vllm/v1/worker/gpu/spec_decode/dflash2/speculator.py`

修改行：L4–6、L13、L15–16、L19–20、L122–127、L144、L228–310、L314–359。

- L194–227生成`candidate_ids[B,7,16]`和`edge_scores[B,7,16,16]`。
- L228–270在GPU/CPU builder之间选择；SM80默认GPU builder。
- L272–310继续生成official protected trunk，维持scheduler的7-token draft contract。
- L314–359写selector/tree诊断。

### 3.3 `csrc/gdn/tree_builder.cu`，L1–27

- L6–12：固定规模heap及stable tie-break。
- L13–25：每请求一个block、一个thread，复现CPU heap；输出token、parent、depth、rank、trunk、full-parent/depth、ancestor和mask。
- L26：shape/device/dtype检查与launcher。
- L27：PyBind。

单thread是有意设计：规模仅`7×16`候选/21输出，优化目标是消除D2H、Python对象和H2D metadata，而不是扩大heap内部并行度。

### 3.4 其余候选生成文件

| 文件及行号 | 作用 |
|---|---|
| `vllm/v1/worker/gpu/spec_decode/tree_builder_cuda.py` L1–15 | JIT加载GPU builder并包装device metadata |
| `vllm/v1/spec_decode/dflash.py` L5、L12、L21–22、L82–126 | proposer tree metadata bridge |
| `vllm/model_executor/layers/logits_processor.py` L207–237 | selector top-k candidate/logits |
| `vllm/v1/worker/gpu/sample/gumbel.py` L84–118、L171–180 | deterministic/Gumbel argmax及processed logits |
| `vllm/v1/spec_decode/llm_base_proposer.py` L627–630、L770–771 | draft结束后生成tree metadata |

## 4. Flattened target主链路

### 4.1 `vllm/v1/worker/gpu/model_runner.py`

修改行：L22、L32–46、L70、L129–134、L1325–1334、L1384–1404、L1439、L1462、L1488–1499、L1601–1933、L2047。

- L1601–1717：旧eager leaf-replay correctness fallback；保存/恢复KV、conv和SSM snapshot。
- L1718–1747：创建`TreeForwardContext`并复用GPU topology。
- L1752–1767：构建anchor+21 nodes输入。
- L1768：一次22-row target forward。
- L1777–1823：GPU tree verify。
- L1828–1855：grouped cache commit。
- L1857–1906：选中路径hidden恢复为vLLM固定8-slot接口。
- L1907–1921：summary trace。

最终E2E路径不是逐leaf target forward。

### 4.2 Metadata和reference

| 文件及行号 | 作用 |
|---|---|
| `vllm/v1/spec_decode/tree_metadata.py` L1–2、L7–34、L45–49、L58–75、L82–83 | flattened token/parent/position、device plan、attention/GDN状态容器 |
| `vllm/v1/worker/gpu/tree_model_runner.py` L4、L8–71 | target runner/reference接口 |
| `vllm/v1/worker/gpu_model_runner.py` L2894 | 把drafter tree metadata传入runner |
| `vllm/v1/worker/gpu/spec_decode/tree_replay.py` L1–212 | 旧snapshot/leaf replay correctness reference |

## 5. GDN CUDA

### 5.1 `vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py`

修改：L67–83、L1223–1633。

- L1223–1248：检测非线性tree context和state row。
- L1251–1328：packed/CUDA backend和parent/depth plan。
- L1334–1356：索引每step缓存，48层复用。
- L1357–1439：fused conv-prep或all-node causal conv。
- L1441–1514：full-state/compact/direct-root recurrent选择。
- L1490–1500：当前CUDA full-state recurrent入口。
- L1515–1546：保存node state与诊断。
- L1548–1633：packed/reference fallback。

### 5.2 `vllm/v1/worker/gpu/spec_decode/tree_hybrid_state.py`，L1–409

- L13–47：depth wave、compact state、DAG plan。
- L48–125：host/device topology转execution plan。
- L126–185：packed-path reference plan。
- L186–238：CUDA wrappers。
- L239–409：PyTorch reference。

### 5.3 `vllm/v1/worker/gpu/spec_decode/tree_gdn_cuda.py`，L1–417

- L16–55：exact gating与SM80认证。
- L56–83：all-node conv；当前默认`allnodes`。
- L86–156：recurrent dispatcher；当前默认`persistent_subwarp16`。
- L244–352：fused conv-prep/cached-root实验。
- L353–416：selected/grouped commit接口。

### 5.4 `csrc/gdn/tree_gdn_dag.cu`，L1–1902

该文件同时保留默认和被拒绝实验kernel：

- L56–175：depth/all-node/topological conv，当前采用all-node。
- L177–504：基础、warp、register和subwarp recurrent。
- L506–578：persistent subwarp，当前正式使用SUBGROUP=16。
- L579–858：topological/depth-parallel/tiled/chunk实验。
- L859–1013：compact state实验。
- L1015–1079：fused conv + exact postprep。
- L1080–1207：单层/grouped GDN和attention commit kernels。
- L1230–1316：conv launcher。
- L1317–1547：17种recurrent launch mode dispatcher。
- L1646–1753：grouped commit和device accepted-count。
- L1875–1902：PyBind。

文件中存在kernel不代表正式路径执行；应结合Python dispatcher和环境变量审查。

## 6. Full attention

### 6.1 `vllm/model_executor/layers/attention/attention.py`，L4、L543–596

检测`TreeForwardContext`；tree转入专用attention，chain继续走vLLM原FA backend。

### 6.2 `vllm/v1/worker/gpu/spec_decode/tree_attention.py`，L1–536

- L10–145：history gather、dense/逐leaf reference。
- L146–243：正式dispatcher。
- L188–232：paged parent CUDA/v2/v3。
- L361–468：cascade实验。
- L469–536：旧vectorized ragged路径。

当前默认：`VLLM_DFLASH2_RAGGED_LAYOUT=paged_parent_v2`。

### 6.3 Parent-sparse CUDA

| 文件及行号 | 作用 |
|---|---|
| `vllm/v1/worker/gpu/spec_decode/tree_parent_attention.py` L1–167 | extension wrapper；L43–74为正式v2，history≤2048默认16 splits |
| `csrc/gdn/tree_parent_attention.cu` L1–997 | parent-sparse、GQA tiled、split-KV、LSE merge和suffix kernels；正式v2 launcher在L797–886 |
| `vllm/v1/worker/gpu/spec_decode/tree_ragged_plan.py` L1–75 | 旧vectorized FA索引plan/reference |

## 7. GPU verify与commit

| 文件及行号 | 作用 |
|---|---|
| `csrc/gdn/tree_verify.cu` L1–54 | prediction→唯一child，输出固定8-row selected/sampled workspace及device count |
| `vllm/v1/worker/gpu/spec_decode/tree_verify_cuda.py` L1–16 | extension与workspace wrapper |
| `vllm/v1/worker/gpu/spec_decode/tree_serving.py` L1–218 | L16–185提交16层KV和48层GDN/conv；L186–218写summary trace |
| `vllm/v1/sample/rejection_sampler.py` L24–25、L128–134、L214–240 | tree sampler兼容/reference路径 |

## 8. Tau与吞吐统计链路

| 文件及行号 | 作用 |
|---|---|
| `vllm/v1/spec_decode/request_trace.py` L1–26 | 每个已commit step写request ID、draft数、accepted数 |
| `vllm/v1/core/sched/scheduler.py` L10、L65、L2460–2466 | 在scheduler实际commit后写trace |
| `vllm/v1/worker/gpu/spec_decode/__init__.py` L6–9、L16–29 | 注册tree接口 |
| `vllm/envs.py` L784–827 | tree/GDN/ragged/trace环境变量 |

## 9. 测试文件

| 文件 | 行号 | 覆盖 |
|---|---:|---|
| `tests/v1/spec_decode/test_dflash2_tree_replay.py` | L1–220 | snapshot、KV query block和leaf replay |
| `tests/v1/spec_decode/test_request_trace.py` | L1–15 | trace格式 |
| `tests/v1/spec_decode/test_tree_gdn_cuda.py` | L1–101 | GDN CUDA output/state |
| `tests/v1/spec_decode/test_tree_hybrid_state.py` | L1–96 | topology、conv/recurrent reference |
| `tests/v1/spec_decode/test_tree_ragged_vectorized.py` | L1–101 | ragged layout exactness |

额外严格测试：

```text
agentWorkSpace/20260919_103000_noncompute_p0_p4/scripts/test_gpu_builder.py
agentWorkSpace/20260919_103000_noncompute_p0_p4/scripts/test_dynamic_commit.py
agentWorkSpace/20260919_103000_noncompute_p0_p4/scripts/test_p2_host_plan.py
agentWorkSpace/20260919_103000_noncompute_p0_p4/scripts/test_p3_workspace.py
```

GPU builder随机100树、GPU verify随机200树、dynamic commit count 1–8及non-default stream均通过。

## 10. Profile与GSM8K-32证据

对应算子profile：

```text
agentWorkSpace/20260919_071500_best_correlated_profile/REPORT.md
agentWorkSpace/20260919_071500_best_correlated_profile/results/correlated.json
agentWorkSpace/20260919_071500_best_correlated_profile/scripts/analyze_correlated.py
```

同history、同trunk的correlated profile：

|部分|Chain GPU ms|Tree GPU ms|增量|
|---|---:|---:|---:|
|target kernels|45.076|56.122|+11.047|
|GDN|12.096|15.388|+3.292|
|full attention|4.165|6.992|+2.826|
|MLP|21.413|23.860|+2.447|
|commit|0|1.434|+1.434|

这是P0–P2前的算子profile；嵌套scope不可相加，也不能替代最终wall。

最终结果：

```text
agentWorkSpace/20260919_103000_noncompute_p0_p4/FINAL_REPORT.md
agentWorkSpace/20260919_103000_noncompute_p0_p4/results/final_tree.json
agentWorkSpace/20260919_103000_noncompute_p0_p4/results/final_chain.json
agentWorkSpace/20260919_103000_noncompute_p0_p4/results/final_chain_repeat.json
```

|方法|tau|ms/step|tok/s|
|---|---:|---:|---:|
|tree|7.120866|88.508|80.180|
|chain run1|6.349071|89.085|70.598|
|chain run2|6.349071|89.657|70.148|
|chain均值|6.349071|89.371|70.373|

Tree相对chain均值为`1.13936× / +13.94%`。

## 11. 可靠性结论和限制

已通过：chain两轮tokens/steps/tau和32/32文本一致；tree多轮轨迹一致；builder/verify/commit均有严格随机、shape和stream测试；负收益P3 workspace已经revert。

限制：最终tree与chain文本24/32一致，不能宣称两种block轨迹逐字一致；结果只覆盖A100 SM80、TP1、batch/concurrency1、eager、无CUDA Graph和GSM8K-32。跨任务与统计稳定性需以当前5×128矩阵为准；双卡固定映射后仍建议交换GPU复测。

## 12. 当前正式测试脚本

```text
/cephfs/shared/wmhu/ylhuang/dLLMSpec_gdn_dag_cuda/
agentWorkSpace/20260919_142207_tree_report_multidataset128/scripts/
```

|脚本|行号|作用|
|---|---:|---|
|`run_exclusive_with_placeholder.sh`|L1–36|验证/停止唯一placeholder，EXIT恢复|
|`run_dual_formal.sh`|L1–64|双服务、五数据集、失败门禁|
|`start_server.sh`|L1–46|chain/tree环境；tree在L22–37显式启用CUDA GDN、GPU build/verify、paged-parent-v2|
|`benchmark_per_request.py`|L16–226|128 prompts、warmup、HTTP counter和wall|
|`analyze.py`|L13–188|scheduler trace校验、tau、throughput、bootstrap|
|`preflight.py`|L28–94|模型/数据SHA和shard检查|

当前运行代码：

```text
vLLM: 4ae600ad845a9bb5fe0998e17182856596faeabb
runner formal code: 60568a3de1cdfe210ff0b1e1f3dc6a0fdb830b49
launcher env-name fix: fc3241176015300e674c3c215741a09b4a3d6f8a
```

当前有效run实际使用了修复后的launcher；根仓库随后增加的clean-gate commit只新增manifest，不改变运行逻辑。
