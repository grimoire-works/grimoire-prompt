# 测试报告 - 任务 13: History API 意图字段

## 第 1 次测试

- 待测文件：`backend/schemas.py`、`backend/routers/history.py`
- 验证方式：FastAPI TestClient + `DATABASE_URL` 指向 /tmp 临时 sqlite 库（脚本 `/tmp/task13_test.py`，不进项目），直插 7 条覆盖净/脏数据的记录

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | GET /api/history items 每条含 original_intents（list 或 null）和 intent_coverage（float 或 null） | ✅ 通过 |
| 2 | 合法 JSON 意图串（`["a","b"]`）正确解析为 list；非法 JSON / 结构错误（合法 JSON 但非 list[str]）返回 null 不 500 | ✅ 通过 |
| 3 | 分页（page/size）、删除单条、清空接口不受影响 | ✅ 通过 |
| 4 | python -m compileall backend/ -q 零错误 | ✅ 通过 |

### AC2 细节验证（均 200，无 500）

| 输入 original_intents | 期望 | 实际 |
|----------------------|------|------|
| `["a","b"]` | `["a","b"]` | `["a","b"]` ✅ |
| NULL | null | null ✅ |
| `not json{{`（非法 JSON） | null | null ✅ |
| `{"a":1}`（JSON dict 非 list） | null | null ✅ |
| `[1,2]`（list 但元素非 str） | null | null ✅ |
| `"just a string"`（JSON 字符串） | null | null ✅ |
| `[]`（空 list） | `[]` | `[]` ✅ |

### AC3 细节验证

- page=1/size=2 → 2 条、total=7；page=4/size=2 → 1 条（分页正确）
- DELETE /api/history/h1 → 200 `{"ok":true}`，删除后 total=6 且 h1 消失；重复删除 → 404
- DELETE /api/history → 200，清空后 total=0、items=[]

静态检查：`python -m compileall backend/ -q` 退出码 0、零输出。

代码质量：`_parse_intents` 对 None/非法 JSON/非 list/非 str 元素逐一防御，类型注解准确，与项目现有风格一致，无严重问题。

### 判定：PASS
