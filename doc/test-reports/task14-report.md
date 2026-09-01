# 测试报告 - 任务 14: 历史记录页面

## 第 1 次测试

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | GET /history 路由返回 history.html（状态码 200，关键元素 history-list/history-detail/clear-btn/prev-page/next-page/page-info/history.js 均存在） | ✅ 通过 |
| 2 | base.html 导航含"历史"链接且顺序正确（优化 → 模板管理 → 历史 → 设置），三个旧页面（/、/templates、/settings）渲染正常且各自 active 高亮不受影响；history.html 中 `{% block nav_history %}active{% endblock %}` 生效 | ✅ 通过 |
| 3 | 分页逻辑：fetch 携带 page/size 参数（size=20 符合后端 le=100 限制）；prevBtn 在 page<=1 禁用、nextBtn 在 page>=maxPage 或空页禁用，点击处另有 guard；page-info 显示"共 N 条 · 第 x/y 页"；删除本页最后一条且 page>1 时 `page -= 1` 回退 | ✅ 通过 |
| 4 | 详情展示：原始提示词 textContent + pre-wrap 全文显示；优化后提示词 `DOMPurify.sanitize(marked.parse(...))` 渲染，marked 或 DOMPurify 任一不可用（`markedAvailable`/`purifyAvailable` 检测）降级 textContent；意图标签逐个 span 渲染（无数据显"未记录"）；覆盖率 round(coverage*100)% + 进度条（role/aria 属性齐全，high/medium/low 变色） | ✅ 通过 |
| 5 | XSS：审查 history.js 全部 DOM 写入点，唯一 innerHTML 在第 198 行且为消毒后 Markdown；其余（列表标题/meta、详情各字段、toast、时间格式化降级值）全部 createElement/textContent；`li.dataset.id` 赋值安全；历史数据中的 `<img onerror>` `<script>` 无执行路径 | ✅ 通过 |
| 6 | 删除单条：confirm → `DELETE /api/history/{encodeURIComponent(id)}`（匹配后端 DELETE /history/{history_id}）；清空：confirm → `DELETE /api/history`（匹配后端 DELETE /history）；两者成功后均刷新 loadHistory，清空重置 page=1 并回到占位态 | ✅ 通过 |
| 7 | CSS 新增样式（history-pagination/history-item-*/history-original/history-section/history-detail-header/history-empty 等）全部使用 var(--*) 变量，无硬编码颜色；`html[data-theme="dark"]` 覆盖 history-pagination/history-original/history-empty 及 md-rendered 代码块 | ✅ 通过 |
| 8 | `node --check static/js/history.js` 通过；`python -m compileall backend/ -q` 零错误；TestClient 渲染 /history 及三个旧页面均正常；`/static/vendor/purify.min.js` 降级文件真实存在（29KB） | ✅ 通过 |

### 测试执行记录

- TestClient 脚本（/tmp/task14_test.py）输出：/history 200 + 全部关键元素；导航顺序 `['/', '/templates', '/history', '/settings']`；三个旧页面各自 active 正确且导航完整；/api/history?page=1&size=5 返回 items/total 结构正常
- 附带验证：marked CDN 无本地降级属于任务 18（marked.js 本地化）范围，本任务 JS 已有 markedAvailable 检测降级路径，符合 AC

### 质量备注（不影响判定）

- `renderPagination` 中 `items.length === 0` 对 nextBtn 的禁用与 `page >= maxPage` 略有冗余，属防御性写法，无害
- history.html 引入 `?v=1` 缓存参数而其他页面未用，风格不完全统一，轻微建议

### 判定：PASS
