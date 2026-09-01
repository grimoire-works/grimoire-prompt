# 测试报告 - 任务 9: 优化接口错误处理改造

## 第 1 次测试

- 待测文件：`backend/routers/optimize.py`
- 测试方式：代码审查 + FastAPI TestClient 运行时验证（临时 sqlite 库，mock provider，测试脚本已清理）
- 静态分析：`python -m compileall backend/ -q` 零错误零警告

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | 模板 id 不存在 → POST /api/optimize 返回 404 + JSON detail | ✅ 通过 |
| 2 | 无 LLM 配置环境 → 返回 400 | ✅ 通过 |
| 3 | LLM 调用抛异常时，SSE 流中包含 type:error 事件并以 done 事件结束，不断流 | ✅ 通过 |
| 4 | 成功路径事件格式不变（intents/content/verify/done） | ✅ 通过 |
| 5 | python -m compileall backend/ -q 零错误 | ✅ 通过 |

### 运行时验证明细

- AC1：404 + `application/json` + `{"detail": "模板不存在"}`
- AC2：空 llm_configs 表 + 有效 template_id → 400 + `{"detail": "请先配置 LLM"}`
- AC3：mock provider `chat_stream` 抛异常 → 响应 200 + `text/event-stream`，事件序列 `[intents, {"type":"error"}, {"done":true}]`，流正常结束
- AC3b（附加）：verify 阶段抛异常 → 流不断流，以 done 事件结束（intent.py 内部降级为全覆盖）
- AC4：成功路径事件序列 `intents → content → content → verify → done(history_id)`，格式与改造前一致
- AC5：compileall 退出码 0

### 代码质量备注（不影响判定）

- `optimize.py:47` `get_provider(config["provider"])` 未捕获 ValueError，DB 中存在非法 provider 时会 500；provider 合法性校验属任务 15 范围，此处不计为问题
- `extract_intents` 在 generator 内未包 try，但其内部已全量捕获异常并降级为空意图（intent.py:81-83），实际无可抛出路径
- `_save_history` 失败仅记日志不影响流结束，`_resolve_llm_config` fallback 逻辑清晰，整体错误处理结构良好

### 判定：PASS
