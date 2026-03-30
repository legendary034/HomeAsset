import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import Location, Category, Tag, Item, CustomField, Document, MaintenanceSchedule  # noqa
from .routers import items, locations, categories, tags, search
from .schemas import StatsResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    os.makedirs("/data/uploads", exist_ok=True)
    os.makedirs("/data/documents", exist_ok=True)
    yield


app = FastAPI(title="HomeAsset", version="1.0.0", lifespan=lifespan)

# ── 1. Static file mounts FIRST ───────────────────────────────────────────────
#    StaticFiles sub-apps are path-prefix matched and resolved quickly.
#    They must sit above the API routers so they are never shadowed.
app.mount("/uploads",   StaticFiles(directory="/data/uploads"),   name="uploads")
app.mount("/documents", StaticFiles(directory="/data/documents"), name="documents")
app.mount("/static",    StaticFiles(directory="app/static"),      name="static")

# ── 2. API Routers SECOND ─────────────────────────────────────────────────────
app.include_router(items.router,      prefix="/api/items",      tags=["items"])
app.include_router(locations.router,  prefix="/api/locations",  tags=["locations"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(tags.router,       prefix="/api/tags",       tags=["tags"])
app.include_router(search.router,     prefix="/api/search",     tags=["search"])


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/stats", response_model=StatsResponse)
def stats(db: Session = Depends(get_db)):
    return {
        "total_items":      db.query(Item).count(),
        "total_locations":  db.query(Location).count(),
        "total_categories": db.query(Category).count(),
        "total_tags":       db.query(Tag).count(),
    }


# ── 3. SPA Catch-all LAST ─────────────────────────────────────────────────────
#    Safety guard: if an /api/* path reaches here it means the route genuinely
#    doesn't exist — return 404 JSON so the browser never receives HTML instead
#    of JSON and shows a cryptic "Unexpected token '<'" error.
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(
            status_code=404,
            content={"detail": f"API route not found: /{full_path}"},
        )
    return FileResponse("app/static/index.html")
