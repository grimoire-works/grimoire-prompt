from datetime import datetime

from pydantic import BaseModel


# ── Template ──

class TemplateResponse(BaseModel):
    id: str
    name: str
    content: str
    template_type: str
    is_builtin: bool
    description: str | None = None
    language: str
    created_at: datetime
    updated_at: datetime


class TemplateCreate(BaseModel):
    name: str
    content: str
    template_type: str = "optimize"
    description: str | None = None
    language: str = "zh"


class TemplateUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    description: str | None = None


# ── LLM Config ──

class LlmConfigCreate(BaseModel):
    name: str
    provider: str  # openai / anthropic / openai_compatible
    api_key: str | None = None
    base_url: str | None = None
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 4096
    is_default: bool = False


class LlmConfigUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    model_name: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    is_default: bool | None = None


class LlmConfigResponse(BaseModel):
    id: str
    name: str
    provider: str
    api_key: str | None  # 返回时脱敏
    base_url: str | None
    model_name: str
    temperature: float
    max_tokens: int
    is_default: bool
    created_at: datetime
    updated_at: datetime


# ── Optimization ──

class OptimizeRequest(BaseModel):
    prompt: str
    template_id: str
    llm_config_id: str | None = None


# ── History ──

class HistoryResponse(BaseModel):
    id: str
    original_prompt: str
    optimized_prompt: str
    template_id: str
    llm_config_id: str
    created_at: datetime


class HistoryListResponse(BaseModel):
    items: list[HistoryResponse]
    total: int
