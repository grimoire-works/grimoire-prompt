# 测试报告 - 任务 16: 数据库轻量迁移

## 第 1 次测试

测试方式：临时 sqlite 库实测（脚本位于 /tmp/task16_test/，未进入项目目录），覆盖 app 级启动（lifespan → _init_db）与 engine 级（ensure_columns 直调）两层。

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | 缺 original_intents/intent_coverage 的 optimization_history 老库（2 条存量数据）启动后列自动补齐，存量数据完整（原始提示词逐条比对一致），GET /api/history 返回 200 且含新字段 | ✅ 通过 |
| 2 | 缺 api_key 列的 llm_configs 老库启动后自动补齐 | ✅ 通过 |
| 3 | 全新库：create_all 建全（templates/llm_configs/optimization_history 全列），ensure_columns 无操作不报错 | ✅ 通过 |
| 4 | NOT NULL 列补齐带默认值：model_name（无标量默认）补为 NOT NULL DEFAULT ''，temperature=0.7、max_tokens=4096、is_default=0，存量行自动填充，未因 NOT NULL 约束失败 | ✅ 通过 |
| 5 | api_key 已存在但为 VARCHAR(256) 时 ensure_columns 不崩溃，类型保持 VARCHAR(256) 不变，仅输出类型差异 info 日志 | ✅ 通过 |
| 6 | python -m compileall backend/ -q 零错误零警告 | ✅ 通过 |

### 判定：PASS
