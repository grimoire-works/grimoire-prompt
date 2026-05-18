from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Template
from backend.schemas import TemplateCreate, TemplateResponse, TemplateUpdate

router = APIRouter()


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).order_by(Template.is_builtin.desc()))
    return result.scalars().all()


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "模板不存在")
    return tpl


@router.post("/templates", response_model=TemplateResponse, status_code=201)
async def create_template(body: TemplateCreate, db: AsyncSession = Depends(get_db)):
    import uuid

    tpl = Template(
        id=f"user-{uuid.uuid4().hex[:8]}",
        name=body.name,
        content=body.content,
        template_type=body.template_type,
        is_builtin=False,
        description=body.description,
        language=body.language,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    body: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "模板不存在")
    if tpl.is_builtin:
        raise HTTPException(400, "内置模板不可编辑")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tpl, field, value)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "模板不存在")
    if tpl.is_builtin:
        raise HTTPException(400, "内置模板不可删除")
    await db.delete(tpl)
    await db.commit()
    return {"ok": True}
