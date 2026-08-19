# Speculative trace dashboard collection

本条目包含 Qwen3-8B 上 DFlash、DSpark 与 EAGLE-3 的 9 个数据集、27 组 step-level trace。

- 入口：`index.html`
- 清单：`manifest.json`
- 每个 `<model>-<dataset>_trace_dashboard/` 目录包含一个三方法汇总页，以及三个算法子目录。
- 算法子目录保留 `run.json`、`steps.jsonl` 和可独立打开的内嵌数据 HTML。

页面数据使用 temperature 0、seed 42 的 sample 0，用于理解 proposal、verification 和 acceptance 流程，不替代 temperature 1 的正式聚合评测。

原始采集与重建说明保存在 private dLLMSpec 仓库的 `agentWorkSpace/speculative_trace_dashboard/`。
