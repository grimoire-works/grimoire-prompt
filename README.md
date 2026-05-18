# Grimoire Prompt

提示词优化工具 — 基于 LLM 的智能 Prompt 优化平台，自动识别意图、结构化输出、流式实时响应。

## 功能特性

- **意图识别与验证** — 优化前自动提取原始意图，优化后验证覆盖率，确保不丢失核心需求
- **多种优化模板** — 内置通用优化、分析式结构优化、输出格式优化等模板，支持自定义
- **多 LLM 支持** — OpenAI、Anthropic Claude、OpenAI 兼容 API（国产模型）
- **流式输出** — SSE 实时流式响应，边生成边查看
- **优化历史** — 完整记录原始提示词、优化结果、意图覆盖率
- **API Key 加密存储** — 密钥加密后存入数据库，安全管理

## 技术栈

- Python 3.12+ / FastAPI
- SQLAlchemy (async) + aiosqlite / asyncmy
- OpenAI SDK + Anthropic SDK
- Jinja2 + 原生 JS
- SSE (Server-Sent Events)

## 快速开始

### 环境要求

- Python 3.12+
- SQLite 或 MySQL

### 安装

```bash
pip install -e .
```

### 配置

复制环境变量模板并填写：

```bash
cp .env.example .env
```

编辑 `.env`：

```
DATABASE_URL=mysql+asyncmy://root:password@127.0.0.1:3306/grimoire_prompt
ENCRYPTION_KEY=<随机 32 字节 base64 密钥>
```

> 默认使用 SQLite，无需配置数据库即可运行。

### 启动

```bash
python main.py
```

访问 http://localhost:8000

### 使用

1. 在 **设置页面** 添加 LLM 配置（API Key、模型名称等）
2. 在 **优化页面** 输入原始提示词，选择优化模板
3. 点击优化，查看实时流式输出和意图覆盖率

## 内置优化模板

| 模板 | 说明 |
|------|------|
| 通用优化 | 标准结构化重组，适合大多数场景 |
| 分析式结构优化 | 深度分析原提示词，完整结构化方案 |
| 通用优化-带输出格式要求 | 增加输出格式控制和约束规范 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/optimize` | 流式优化提示词（SSE） |
| GET | `/api/templates` | 获取模板列表 |
| POST | `/api/templates` | 创建自定义模板 |
| GET | `/api/llm-configs` | 获取 LLM 配置列表 |
| POST | `/api/llm-configs` | 添加 LLM 配置 |
| GET | `/api/history` | 获取优化历史 |

## 项目结构

```
grimoire-prompt/
├── main.py                  # 入口文件
├── backend/
│   ├── main.py              # FastAPI 应用
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models.py            # 数据模型
│   ├── schemas.py           # 请求/响应 Schema
│   ├── llm.py               # LLM 客户端（OpenAI / Anthropic）
│   ├── intent.py            # 意图识别与验证
│   ├── builtins.py          # 内置优化模板
│   └── routers/             # API 路由
│       ├── optimize.py      # 优化接口
│       ├── template.py      # 模板管理
│       ├── llm_config.py    # LLM 配置管理
│       ├── history.py       # 历史记录
│       └── pages.py         # 页面路由
├── static/                  # 静态资源（CSS / JS）
├── templates/               # Jinja2 页面模板
└── pyproject.toml           # 项目配置
```

## License

[MIT](LICENSE)
