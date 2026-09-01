# 测试报告 - 任务 18: marked.js 本地化

## 第 1 次测试

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | static/vendor/marked.min.js 存在（39903 字节），文件头标记 `marked v15.0.12`（15.x ✓）；static/vendor/purify.min.js 完好（29204 字节，文件头标记 `DOMPurify 3.4.14`） | ✅ 通过 |
| 2 | templates/optimize.html:64-65 与 templates/history.html:31-32 均引用 `/static/vendor/marked.min.js` + `/static/vendor/purify.min.js`；templates/ 全目录 grep 无 jsdelivr/unpkg/cdnjs 外链；backend/main.py:42 `app.mount("/static", StaticFiles(directory=BASE_DIR / "static"))` 路径匹配 | ✅ 通过 |
| 3 | TestClient 实测：GET /static/vendor/marked.min.js → 200（39903 字节，application/javascript）；GET /static/vendor/purify.min.js → 200（29204 字节） | ✅ 通过 |
| 4 | optimize.js:20-21、history.js:18-19 的 `markedAvailable`/`purifyAvailable` 检测保留；node 沙箱（vm context 不注入 marked/DOMPurify，模拟 404）实测两文件：检测均为 false，降级 `textContent` 赋值成功、未走 innerHTML、无同步异常 | ✅ 通过 |
| 5 | 渲染链路未回退：optimize.js:42 与 history.js:198 均保持 `DOMPurify.sanitize(marked.parse(...))` 消毒后写入 innerHTML | ✅ 通过 |
| 6 | README.md:11 描述为「marked + DOMPurify 本地化加载（`static/vendor/`），无需外部 CDN」，无过时 CDN 描述 | ✅ 通过 |
| 7 | `node --check static/js/optimize.js static/js/history.js` 通过；`python -m compileall backend/ -q` 零输出零错误 | ✅ 通过 |

### 判定：PASS
