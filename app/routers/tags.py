from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Tag
from ..schemas import TagCreate, TagResponse

router = APIRouter()


@router.get("/", response_model=List[TagResponse])
def get_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("/", response_model=TagResponse)
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
