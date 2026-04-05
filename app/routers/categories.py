from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..schemas import CategoryCreate, CategoryUpdate, CategoryResponse, BulkCategoryAssociate
from ..models import Category, Item

router = APIRouter()


@router.get("", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryResponse)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"ok": True}

@router.post("/associate")
def associate_category(data: BulkCategoryAssociate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == data.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
        
    items = db.query(Item).filter(Item.id.in_(data.item_ids)).all()
    for item in items:
        item.category_id = cat.id
    db.commit()
    return {"ok": True, "updated": len(items)}
