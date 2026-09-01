import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crypto import decrypt_secret
from backend.database import get_db
from backend.intent import extract_intents, verify_intents
from backend.llm import build_messages, get_provider
from backend.models import LlmConfig, OptimizationHistory, Template
from backend.schemas import OptimizeRequest

logger = logging.getLogger(__name__)

router = APIRouter()


def _sse_event(payload: dict) -> str:
    """格式化 SSE 数据行。"""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


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
        raise HTTPException(status_code=404, detail="模板不存在")

    # 2. 构建 LLM 消息
    messages = build_messages(template.content, body.prompt)

    # 3. 解析 LLM 配置
    config = await _resolve_llm_config(db, body.llm_config_id)
    if not config:
        raise HTTPException(status_code=400, detail="请先配置 LLM")

    provider = get_provider(config["provider"])
    history_id = str(uuid.uuid4())
    full_text_parts: list[str] = []

    async def stream_generator():
        # ① 意图提取（流开始前，~1-2秒；内部已容错降级，失败返回空意图）
        intent_result = await extract_intents(provider, config, body.prompt)
        intents = intent_result.get("intents", [])
        if intents:
            yield _sse_event(
                {"type": "intents", "intents": intents, "summary": intent_result.get("summary", "")}
            )

        # ② 模板优化（流式输出）；异常时发 error 事件后正常结束流，
        # 已输出的部分内容保留在前端，不让异常直接断流
        try:
            async for chunk in provider.chat_stream(messages, config):
                full_text_parts.append(chunk)
                yield _sse_event({"content": chunk})
        except Exception as e:
            logger.error("LLM 流式优化失败: %s", e, exc_info=True)
            yield _sse_event({"type": "error", "message": f"优化输出失败：{e}"})
            yield _sse_event({"done": True})
            return

        full_text = "".join(full_text_parts)

        # ③ 意图验证（流结束后，不阻塞用户看到结果）
        try:
            verify_result = await verify_intents(provider, config, intents, full_text)
        except Exception as e:
            logger.error("意图验证失败: %s", e, exc_info=True)
            yield _sse_event({"type": "error", "message": f"意图验证失败：{e}"})
            yield _sse_event({"done": True})
            return

        coverage_rate = verify_result.get("coverage_rate", 1.0)
        missing = verify_result.get("missing", [])

        # 保存历史（含意图信息）；失败仅记日志，不影响流正常结束
        try:
            await _save_history(
                db, history_id, body.prompt, full_text,
                template.id, config["id"],
                json.dumps(intents, ensure_ascii=False) if intents else None,
                coverage_rate,
            )
        except Exception as e:
            logger.error("保存优化历史失败（已跳过）: %s", e, exc_info=True)

        # 推送验证结果
        yield _sse_event(
            {"type": "verify", "covered": verify_result.get("covered", []), "missing": missing, "coverage_rate": coverage_rate}
        )
        yield _sse_event({"done": True, "history_id": history_id})

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
        "api_key": decrypt_secret(llm_config.api_key) or "",
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
