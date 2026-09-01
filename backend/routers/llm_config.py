from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crypto import decrypt_secret, encrypt_secret
from backend.database import get_db
from backend.llm import get_provider
from backend.models import LlmConfig
from backend.schemas import LlmConfigCreate, LlmConfigResponse, LlmConfigUpdate

router = APIRouter()


def _mask_api_key(key: str | None) -> str | None:
    if not key or len(key) < 8:
        return "****" if key else None
    return "****" + key[-4:]


def _to_response(cfg: LlmConfig) -> dict:
    return {
        "id": cfg.id,
        "name": cfg.name,
        "provider": cfg.provider,
        "api_key": _mask_api_key(decrypt_secret(cfg.api_key)),
        "base_url": cfg.base_url,
        "model_name": cfg.model_name,
        "temperature": cfg.temperature,
        "max_tokens": cfg.max_tokens,
        "is_default": cfg.is_default,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
    }


@router.get("/llm-configs")
async def list_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LlmConfig).order_by(LlmConfig.created_at.desc()))
    return [_to_response(c) for c in result.scalars().all()]


@router.post("/llm-configs", status_code=201)
async def create_config(body: LlmConfigCreate, db: AsyncSession = Depends(get_db)):
    # 如果设为默认，先取消其他默认
    if body.is_default:
        await db.execute(
            update(LlmConfig).where(LlmConfig.is_default == True).values(is_default=False)
        )

    cfg = LlmConfig(
        name=body.name,
        provider=body.provider,
        api_key=encrypt_secret(body.api_key),
        base_url=body.base_url,
        model_name=body.model_name,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        is_default=body.is_default,
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return _to_response(cfg)


@router.put("/llm-configs/{config_id}")
async def update_config(
    config_id: str,
    body: LlmConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LlmConfig).where(LlmConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "配置不存在")

    data = body.model_dump(exclude_unset=True)

    # api_key 非空时加密入库（历史明文在下次保存时自动变为密文）
    if data.get("api_key"):
        data["api_key"] = encrypt_secret(data["api_key"])

    # 如果设为默认，先取消其他默认
    if data.get("is_default"):
        await db.execute(
            update(LlmConfig).where(LlmConfig.is_default == True).values(is_default=False)
        )

    for field, value in data.items():
        setattr(cfg, field, value)
    await db.commit()
    await db.refresh(cfg)
    return _to_response(cfg)


@router.delete("/llm-configs/{config_id}")
async def delete_config(config_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LlmConfig).where(LlmConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "配置不存在")
    await db.delete(cfg)
    await db.commit()
    return {"ok": True}


@router.post("/llm-configs/{config_id}/test")
async def test_config(config_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LlmConfig).where(LlmConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "配置不存在")

    provider = get_provider(cfg.provider)
    ok = await provider.test_connection({
        "api_key": decrypt_secret(cfg.api_key) or "",
        "base_url": cfg.base_url,
        "model_name": cfg.model_name,
        "temperature": 0.7,
        "max_tokens": 10,
    })
    return {"ok": ok}
