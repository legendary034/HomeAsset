from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List

from ..database import get_db
from ..models import Item, Tag
from ..schemas import ItemSummary

router = APIRouter()


@router.get("/", response_model=List[ItemSummary])
def search_items(
    q: Optional[str] = None,
    tag_ids: Optional[str] = None,
    location_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Item)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Item.name.ilike(term),
                Item.description.ilike(term),
                Item.serial_number.ilike(term),
                Item.model_number.ilike(term),
                Item.notes.ilike(term),
            )
        )

    if tag_ids:
        ids = [int(x) for x in tag_ids.split(",") if x.strip().isdigit()]
        if ids:
            query = query.join(Item.tags).filter(Tag.id.in_(ids)).distinct()

    if location_id:
        query = query.filter(Item.location_id == location_id)

    if category_id:
        query = query.filter(Item.category_id == category_id)

    return query.order_by(Item.name).limit(200).all()
