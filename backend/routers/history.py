from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import OptimizationHistory
from backend.schemas import HistoryListResponse, HistoryResponse

router = APIRouter()


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
