import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import engine, Base
from .models import Location, Category, Tag, Item, CustomField, Document, MaintenanceSchedule  # noqa – ensure all models registered
from .routers import items, locations, categories, tags, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    os.makedirs("/data/uploads", exist_ok=True)
    os.makedirs("/data/documents", exist_ok=True)
    yield


app = FastAPI(title="HomeAsset", version="1.0.0", lifespan=lifespan)

# ── API Routers ────────────────────────────────────────────────────────────────
app.include_router(items.router, prefix="/api/items", tags=["items"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(search.router, prefix="/api/search", tags=["search"])

# ── Static file mounts ─────────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="/data/uploads"), name="uploads")
app.mount("/documents", StaticFiles(directory="/data/documents"), name="documents")
app.mount("/static", StaticFiles(directory="app/static"), name="static")


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Stats ──────────────────────────────────────────────────────────────────────
from sqlalchemy.orm import Session  # noqa
from fastapi import Depends  # noqa
from .database import get_db  # noqa
from .schemas import StatsResponse  # noqa


@app.get("/api/stats", response_model=StatsResponse)
def stats(db: Session = Depends(get_db)):
    return {
        "total_items": db.query(Item).count(),
        "total_locations": db.query(Location).count(),
        "total_categories": db.query(Category).count(),
        "total_tags": db.query(Tag).count(),
    }


# ── SPA catch-all ──────────────────────────────────────────────────────────────
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    return FileResponse("app/static/index.html")
