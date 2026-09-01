from fastapi import APIRouter, Request

from backend.main import templates

router = APIRouter()


@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse("optimize.html", {"request": request})


@router.get("/templates")
async def templates_page(request: Request):
    return templates.TemplateResponse("templates.html", {"request": request})


@router.get("/history")
async def history_page(request: Request):
    return templates.TemplateResponse("history.html", {"request": request})


@router.get("/settings")
async def settings_page(request: Request):
    return templates.TemplateResponse("settings.html", {"request": request})
