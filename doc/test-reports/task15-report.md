# 测试报告 - 任务 15: provider 校验 + 意图提取 token 上限

## 第 1 次测试

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | POST /api/llm-configs provider="foo" → 422；provider="openai"/"openai_compatible"/"anthropic" 正常创建（201） | ✅ 通过 |
| 2 | PUT /api/llm-configs/{id} provider="foo" → 422；不传 provider（200）或传合法值（200）正常 | ✅ 通过 |
| 3 | backend/intent.py 两处 max_tokens 均为 2000（extract_intents:74、verify_intents:111），无 500 残留 | ✅ 通过 |
| 4 | python -m compileall backend/ -q 零错误 | ✅ 通过 |

验证方式：FastAPI TestClient + 临时 sqlite（脚本 /tmp/test_task15.py，引擎在 import 前替换为临时库，未触发 lifespan，项目数据库零副作用），8/8 断言通过。

### 判定：PASS
