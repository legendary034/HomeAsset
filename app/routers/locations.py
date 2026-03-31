from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Location
from ..schemas import LocationCreate, LocationUpdate, LocationNode, LocationFlat

router = APIRouter()


def _build_tree(locations: list, parent_id=None) -> list:
    result = []
    for loc in locations:
        if loc.parent_id == parent_id:
            children = _build_tree(locations, loc.id)
            result.append({
                "id": loc.id,
                "name": loc.name,
                "description": loc.description,
                "parent_id": loc.parent_id,
                "icon": loc.icon,
                "color": loc.color,
                "item_count": len(loc.items),
                "children": children,
            })
    return result


@router.get("", response_model=List[LocationNode])
def get_locations(db: Session = Depends(get_db)):
    locations = db.query(Location).all()
    return _build_tree(locations)


@router.get("/flat", response_model=List[LocationFlat])
def get_locations_flat(db: Session = Depends(get_db)):
    return db.query(Location).order_by(Location.name).all()


@router.get("/{location_id}")
def get_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return {
        "id": loc.id,
        "name": loc.name,
        "description": loc.description,
        "parent_id": loc.parent_id,
        "icon": loc.icon,
        "color": loc.color,
        "item_count": len(loc.items),
        "children": [
            {"id": c.id, "name": c.name, "icon": c.icon,
             "color": c.color, "item_count": len(c.items), "children": []}
            for c in loc.children
        ],
    }


@router.post("")
def create_location(data: LocationCreate, db: Session = Depends(get_db)):
    if data.parent_id:
        parent = db.query(Location).filter(Location.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent location not found")
    loc = Location(**data.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return {"id": loc.id, "name": loc.name, "parent_id": loc.parent_id,
            "icon": loc.icon, "color": loc.color, "item_count": 0, "children": []}


@router.put("/{location_id}")
def update_location(location_id: int, data: LocationUpdate, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return {"id": loc.id, "name": loc.name, "parent_id": loc.parent_id,
            "icon": loc.icon, "color": loc.color, "item_count": len(loc.items), "children": []}


@router.delete("/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(loc)
    db.commit()
    return {"ok": True}
