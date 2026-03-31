import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import Location, Category, Tag, Item
from .routers import items, locations, categories, tags, search
from .schemas import StatsResponse

# ── Create upload dirs at MODULE LOAD TIME ─────────────────────────────────────
# Must happen before StaticFiles() is called, because the Docker volume mount
# replaces /data with the (initially empty) host ./data directory, so the
# dirs that the Dockerfile created inside the image don't survive.
os.makedirs("/data/uploads",   exist_ok=True)
os.makedirs("/data/documents", exist_ok=True)


def _seed_data(db: Session) -> None:
    """Populate the DB with starter data on first boot."""
    if db.query(Location).count() > 0:
        return  # already seeded

    # Locations
    house    = Location(name="House",     icon="🏠", color="#6366f1")
    garage   = Location(name="Garage",    icon="🚗", color="#f59e0b", parent=house)
    basement = Location(name="Basement",  icon="🧱", color="#64748b", parent=house)
    living   = Location(name="Living Room", icon="🛋️", color="#10b981", parent=house)
    shelf_a  = Location(name="Shelf A",   icon="📦", color="#6366f1", parent=garage)
    shelf_b  = Location(name="Shelf B",   icon="📦", color="#6366f1", parent=garage)
    db.add_all([house, garage, basement, living, shelf_a, shelf_b])

    # Categories
    cats = [
        Category(name="Tools",       icon="🔧", color="#f59e0b"),
        Category(name="Seasonal",    icon="🌿", color="#10b981"),
        Category(name="Electronics", icon="⚡", color="#6366f1"),
        Category(name="Clothing",    icon="👕", color="#ec4899"),
        Category(name="Documents",   icon="📄", color="#64748b"),
        Category(name="Sporting",    icon="🏋️", color="#ef4444"),
    ]
    db.add_all(cats)

    # Tags
    tag_names = ["fragile", "seasonal", "important", "tools", "spare", "donated"]
    db.add_all([Tag(name=t) for t in tag_names])

    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Seed starter data if DB is brand-new
    db = next(get_db())
    try:
        _seed_data(db)
    finally:
        db.close()
    yield


app = FastAPI(title="HomeAsset", version="1.0.0", lifespan=lifespan)

# ── 1. API Routers FIRST ───────────────────────────────────────────────────────
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


# ── 2. Static file mounts SECOND ──────────────────────────────────────────────
app.mount("/uploads",   StaticFiles(directory="/data/uploads"),   name="uploads")
app.mount("/documents", StaticFiles(directory="/data/documents"), name="documents")
app.mount("/static",    StaticFiles(directory="app/static"),      name="static")


# ── 3. SPA catch-all LAST ─────────────────────────────────────────────────────
from fastapi import HTTPException  # noqa

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    # Never serve the SPA for API paths — return a proper 404 instead
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    return FileResponse("app/static/index.html")
