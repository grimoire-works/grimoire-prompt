import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import OptimizationHistory
from backend.schemas import HistoryListResponse, HistoryResponse

router = APIRouter()


def _parse_intents(raw: str | None) -> list[str] | None:
    """把数据库中 JSON 字符串形式的意图列表解析为 list；None/脏数据返回 None。"""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(parsed, list) or not all(isinstance(i, str) for i in parsed):
        return None
    return parsed


@router.get("/history")
async def list_history(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # 总数
    total_result = await db.execute(select(func.count(OptimizationHistory.id)))
    total = total_result.scalar() or 0

    # 分页
    result = await db.execute(
        select(OptimizationHistory)
        .order_by(OptimizationHistory.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": h.id,
                "original_prompt": h.original_prompt,
                "optimized_prompt": h.optimized_prompt,
                "template_id": h.template_id,
                "llm_config_id": h.llm_config_id,
                "original_intents": _parse_intents(h.original_intents),
                "intent_coverage": h.intent_coverage,
                "created_at": h.created_at,
            }
            for h in items
        ],
        "total": total,
    }


@router.delete("/history/{history_id}")
async def delete_history(history_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OptimizationHistory).where(OptimizationHistory.id == history_id)
    )
    h = result.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "记录不存在")
    await db.delete(h)
    await db.commit()
    return {"ok": True}


@router.delete("/history")
async def clear_history(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(OptimizationHistory))
    await db.commit()
    return {"ok": True}
