import json
import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.intent import extract_intents, verify_intents
from backend.llm import build_messages, get_provider
from backend.models import LlmConfig, OptimizationHistory, Template
from backend.schemas import OptimizeRequest

router = APIRouter()


@router.post("/optimize")
async def optimize(
    body: OptimizeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """流式优化提示词（SSE），含意图提取与验证。"""
    # 1. 加载模板
    result = await db.execute(select(Template).where(Template.id == body.template_id))
    template = result.scalar_one_or_none()
    if not template:
        return {"error": "模板不存在"}

    # 2. 构建 LLM 消息
    messages = build_messages(template.content, body.prompt)

    # 3. 解析 LLM 配置
    config = await _resolve_llm_config(db, body.llm_config_id)
    if not config:
        return {"error": "请先配置 LLM"}

    provider = get_provider(config["provider"])
    history_id = str(uuid.uuid4())
    full_text_parts: list[str] = []

    async def stream_generator():
        # ① 意图提取（流开始前，~1-2秒）
        intent_result = await extract_intents(provider, config, body.prompt)
        intents = intent_result.get("intents", [])
        if intents:
            yield f"data: {json.dumps({'type': 'intents', 'intents': intents, 'summary': intent_result.get('summary', '')}, ensure_ascii=False)}\n\n"

        # ② 模板优化（流式输出）
        async for chunk in provider.chat_stream(messages, config):
            full_text_parts.append(chunk)
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

        full_text = "".join(full_text_parts)

        # ③ 意图验证（流结束后，不阻塞用户看到结果）
        verify_result = await verify_intents(provider, config, intents, full_text)
        coverage_rate = verify_result.get("coverage_rate", 1.0)
        missing = verify_result.get("missing", [])

        # 保存历史（含意图信息）
        await _save_history(
            db, history_id, body.prompt, full_text,
            template.id, config["id"],
            json.dumps(intents, ensure_ascii=False) if intents else None,
            coverage_rate,
        )

        # 推送验证结果
        yield f"data: {json.dumps({'type': 'verify', 'covered': verify_result.get('covered', []), 'missing': missing, 'coverage_rate': coverage_rate}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'done': True, 'history_id': history_id}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _resolve_llm_config(db: AsyncSession, config_id: str | None) -> dict | None:
    """解析 LLM 配置，返回调用参数 dict。"""
    if config_id:
        result = await db.execute(select(LlmConfig).where(LlmConfig.id == config_id))
    else:
        result = await db.execute(
            select(LlmConfig).where(LlmConfig.is_default == True).limit(1)
        )

    llm_config = result.scalar_one_or_none()
    if not llm_config:
        # fallback: 取第一个配置
        result = await db.execute(select(LlmConfig).limit(1))
        llm_config = result.scalar_one_or_none()

    if not llm_config:
        return None

    return {
        "id": llm_config.id,
        "provider": llm_config.provider,
        "api_key": llm_config.api_key or "",
        "base_url": llm_config.base_url,
        "model_name": llm_config.model_name,
        "temperature": llm_config.temperature,
        "max_tokens": llm_config.max_tokens,
    }


async def _save_history(
    db: AsyncSession,
    history_id: str,
    original: str,
    optimized: str,
    template_id: str,
    llm_config_id: str,
    original_intents: str | None = None,
    intent_coverage: float | None = None,
):
    """异步保存优化历史（在独立 session 中执行，避免流式响应 session 冲突）。"""
    from backend.database import async_session

    async with async_session() as session:
        history = OptimizationHistory(
            id=history_id,
            original_prompt=original,
            optimized_prompt=optimized,
            template_id=template_id,
            llm_config_id=llm_config_id,
            original_intents=original_intents,
            intent_coverage=intent_coverage,
        )
        session.add(history)
        await session.commit()
