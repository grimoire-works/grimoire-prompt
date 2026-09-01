from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from backend.database import Base, engine
from backend.migrate import ensure_columns

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


async def _init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 轻量迁移：老库已存在的表补充模型新增的列（新库无操作）
    await ensure_columns(engine)

    from backend.builtins import seed_builtin_templates
    await seed_builtin_templates()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _init_db()
    yield


app = FastAPI(title="Grimoire Prompt", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")

from backend.routers import pages, optimize, template, llm_config, history  # noqa: E402

app.include_router(pages.router)
app.include_router(optimize.router, prefix="/api")
app.include_router(template.router, prefix="/api")
app.include_router(llm_config.router, prefix="/api")
app.include_router(history.router, prefix="/api")
