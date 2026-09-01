# 测试报告 - 任务 12: API Key 加密存储

## 第 1 次测试

测试环境：FastAPI TestClient + 临时 sqlite 库（/tmp），脚本不进项目。
测试密钥环境分两组：① 默认占位符（未设 ENCRYPTION_KEY）② 合法随机 32 字节 base64 密钥。

### 验收标准验证

| # | 验收标准 | 结果 | 说明 |
|---|---------|------|------|
| 1 | encrypt→decrypt 往返一致；同一明文两次加密密文不同 | ✅ 通过 | 往返一致；两次密文不同（Fernet 随机 IV）；空值原样返回 |
| 2 | POST /api/llm-configs 带 api_key → 库中存密文 | ✅ 通过 | 201 入库；sqlite 文件字节级搜索不到明文；存储值为 `gAAAAAB...` Fernet 密文且可解密回明文 |
| 3 | 历史明文 key 兼容 | ✅ 通过 | 直插明文行后：`_resolve_llm_config` 返回明文 key；`/test` 返回 200 `{"ok": false}`（无 500/崩溃）；GET 脱敏正确；PUT 重存后变为密文且可解密 |
| 4 | 占位 encryption_key：功能正常仅 warning | ✅ 通过 | 占位环境下 20 项功能用例全部通过，模块加载时发出 warning 未崩溃；合法密钥环境下无 warning、往返正常 |
| 5 | String(512) 列宽：160 字符明文不截断 | ✅ 通过 | 160 字符明文 → 密文 312 字符 ≤ 512；解密还原完整；脱敏显示完整明文末 4 位 |
| 6 | 脱敏（****末4位）基于解密后明文 | ✅ 通过 | 密文行与历史明文行均返回 `****` + 明文末 4 位 |
| 7 | compileall 零错误；cryptography 在 pyproject.toml | ✅ 通过 | `python -m compileall backend/ -q` 退出码 0；pyproject 含 `cryptography>=43.0`（实测 48.0.0） |

补充核对：plan.md Task 12 要求 README 与实现一致 — README 已包含"API Key 加密存储"特性说明与 `ENCRYPTION_KEY` 配置项（第 12、47 行），与 `.env.example`、代码占位符 `changeme_to_random_base64_key` 三处一致。

静态审查：`backend/crypto.py` 密钥派生逻辑健壮（占位/非法值 → sha256 稳定派生 + warning；合法 32 字节 base64 → 直接使用）；`decrypt_secret` 对历史明文的兜底（InvalidToken/ValueError/UnicodeEncodeError → 原样返回）覆盖了全部失败路径。未发现代码质量问题。

### 判定：PASS
