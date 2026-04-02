from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Tag, Item
from ..schemas import TagCreate, TagResponse, BulkTags, BulkTagDelete, BulkTagAssociate

router = APIRouter()


@router.get("", response_model=List[TagResponse])
def get_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("", response_model=TagResponse)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    # Return existing tag if name already used (case-insensitive)
    existing = db.query(Tag).filter(Tag.name.ilike(data.name)).first()
    if existing:
        return existing
    tag = Tag(name=data.name.strip())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"ok": True}

@router.post("/bulk", response_model=List[TagResponse])
def create_tags_bulk(data: BulkTags, db: Session = Depends(get_db)):
    created = []
    for name in data.names:
        name = name.strip()
        if not name:
            continue
        existing = db.query(Tag).filter(Tag.name.ilike(name)).first()
        if existing:
            created.append(existing)
        else:
            tag = Tag(name=name)
            db.add(tag)
            created.append(tag)
    db.commit()
    for t in created:
        db.refresh(t)
    # Removing duplicates if identical names were supplied
    unique_created = []
    seen = set()
    for t in created:
        if t.id not in seen:
            seen.add(t.id)
            unique_created.append(t)
    return unique_created

@router.post("/bulk-delete")
def delete_tags_bulk(data: BulkTagDelete, db: Session = Depends(get_db)):
    db.query(Tag).filter(Tag.id.in_(data.tag_ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}

@router.post("/associate")
def associate_tags(data: BulkTagAssociate, db: Session = Depends(get_db)):
    items = db.query(Item).filter(Item.id.in_(data.item_ids)).all()
    tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all()
    for item in items:
        existing_tag_ids = {t.id for t in item.tags}
        for tag in tags:
            if tag.id not in existing_tag_ids:
                item.tags.append(tag)
    db.commit()
    return {"ok": True}
