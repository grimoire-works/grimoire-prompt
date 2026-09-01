# CLAUDE.md — grimoire-prompt

## 项目概述

提示词优化工具，基于 Python + FastAPI 构建。

## 技术栈

- **语言**：Python 3.12+
- **框架**：FastAPI + Uvicorn
- **数据库**：SQLAlchemy (async) + aiosqlite/asyncmy
- **模板**：Jinja2
- **LLM 集成**：OpenAI SDK + Anthropic SDK
- **加密**：cryptography（Fernet，API Key 加密存储）

## 项目结构

```
grimoire-prompt/
├── main.py              # 入口文件
├── backend/
│   ├── main.py          # FastAPI app
│   ├── config.py        # 配置
│   ├── crypto.py        # API Key Fernet 加密/解密
│   ├── database.py      # 数据库连接
│   ├── migrate.py       # 启动时轻量数据库迁移（缺列自动补齐）
│   ├── models.py        # SQLAlchemy 模型
│   ├── schemas.py       # Pydantic schemas
│   ├── llm.py           # LLM 调用逻辑
│   ├── builtins.py      # 内置数据
│   ├── intent.py        # 意图识别
│   └── routers/         # API 路由
│       ├── optimize.py  # 优化接口（SSE 流式）
│       ├── template.py  # 模板管理接口
│       ├── history.py   # 历史记录接口（返回 original_intents/intent_coverage）
│       ├── pages.py     # 页面路由（/、/history 等）
│       └── llm_config.py # LLM 配置接口
├── static/
│   ├── js/              # 前端 JS（optimize、history、templates、settings、theme-toggle）
│   └── vendor/          # 本地第三方库（marked.min.js、purify.min.js，无 CDN 依赖）
├── templates/           # Jinja2 模板（base、optimize、history、templates、settings）
└── pyproject.toml       # 项目配置
```

## 常用命令

- **启动开发服务器**：`python main.py`
- **依赖安装**：`pip install -e .`
- **语法检查**：`python -m compileall backend/ -q`

## 多智能体工作流

本项目使用**主智能体编排 + 子Agent分工**的工作模式。

### 何时使用编排模式

**走编排流程的触发方式**（读 `.claude/主智能体提示词.md`，按流程执行）：
- 用户说"走编排流程"/"编排"/"开始执行"且 `doc/plan.md` 中有 ⏳ 任务
- 用户确认新功能/需求后（如"开始开发"、"方案OK，开始实施"等），**必须用 AskUserQuestion 询问**：
  > 检测到新需求已确认，是否进入编排模式？
  > - 是，走编排流程（委托子Agent开发+测试）
  > - 否，直接处理

**其他日常对话和简单问题直接处理**，不启动编排。

**核心规则**：主Agent只调度不干活，不直接编辑源代码文件。

### 执行模式

- **Subagent 串行模式**（默认）：适合 ≤10 个任务，稳定可控
  - 提示词：`.claude/主智能体提示词.md`
- **Agent Teams 并行模式**：适合 >10 个任务，需要启用实验性功能
  - 提示词：`.claude/主智能体提示词-teams.md`
  - 启用方式：在 `~/.claude/settings.json` 添加 `{"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"1"}}`

说"走编排流程"时，会根据任务数自动建议执行模式。

### Agent 角色

- 需求规划 → 委托 `grim-pm` 子Agent
- UI 设计 → 委托 `grim-designer` 子Agent
- 前端开发 → 委托 `grim-frontend` 子Agent
- 核心开发 → 委托 `grim-dev` 子Agent
- 测试审查 → 委托 `grim-tester` 子Agent

### 文档

- 任务计划 → `doc/plan.md`（主Agent管理）
- 经验库 → `doc/lessons-learned.md`（开发Agent追加，禁止 Write 覆盖）
- 协调日志 → `doc/main-log.md`（主Agent编写）
- 测试报告 → `doc/test-reports/`（测试Agent写入）
- PRD 文档 → `doc/prd/prd.md`（PM Agent写入）
- 设计方案 → `doc/design/`（designer Agent写入）
- 技术方案 → `doc/dev/dev-plan.md`（dev Agent写入）
- 交接文档 → `doc/handoff.md`（编排中断时自动生成）

## 项目级 UI 规则

以下规则由 multi-agent-init 自动追加，适用于所有 Agent：

### 工具选择

1. **几何连接的可视化必须用 SVG/Canvas，禁止用 CSS div 硬拼线条**
   - ✅ 指针、连线、路径 → SVG `<path>` / `<line>` / Canvas
   - ❌ div + background + transform: rotate() 模拟线条
   - 原因：CSS div 是矩形布局工具，不是画线工具。每次尺寸变化都会导致角度、对齐全部重新计算

2. **复杂拟物组件，一开始就建立统一坐标系**
   - 用 SVG viewBox 或 Canvas 统一所有元素坐标
   - 禁止部分元素在容器坐标系、部分在子元素坐标系中定位
   - 原因：多坐标系 = 每次改一个元素，其他全部错位

### 开发策略

3. **复杂组件改了 3 轮还不对，就整体重写，不要打补丁**
   - 打补丁：改A→B坏→改B→C坏→无限循环
   - 重写：重新设计结构→一次性正确

4. **UI 组件先定坐标系和尺寸，再填内容**
   - 先确定容器宽高和元素绝对坐标
   - 再写样式和交互逻辑
   - 避免边写边调导致的「一切都要重新算」
