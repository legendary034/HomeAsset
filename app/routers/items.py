import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Item, Tag, CustomField, Document
from ..schemas import ItemCreate, ItemUpdate, ItemSummary, ItemDetail, DocumentResponse

router = APIRouter()

UPLOAD_DIR = "/data/uploads"
DOCUMENT_DIR = "/data/documents"


def _get_or_404(db, item_id):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# ── List / Filter ──────────────────────────────────────────────────────────────

@router.get("", response_model=List[ItemSummary])
def get_items(
    location_id: Optional[int] = None,
    category_id: Optional[int] = None,
    tag_ids: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Item)
    if location_id is not None:
        query = query.filter(Item.location_id == location_id)
    if category_id is not None:
        query = query.filter(Item.category_id == category_id)
    if tag_ids:
        ids = [int(x) for x in tag_ids.split(",") if x.strip().isdigit()]
        if ids:
            query = query.join(Item.tags).filter(Tag.id.in_(ids)).distinct()
    return query.order_by(Item.name).all()


import csv
import io
from datetime import datetime

from ..models import Location


# ── CSV Export ────────────────────────────────────────────────────────────────

@router.get("/export")
def export_items_csv(db: Session = Depends(get_db)):
    """Download all items as a CSV file."""
    from fastapi.responses import StreamingResponse

    items = db.query(Item).order_by(Item.name).all()
    locations = {loc.id: loc for loc in db.query(Location).all()}

    def loc_path(location_id):
        if not location_id:
            return ""
        parts = []
        loc = locations.get(location_id)
        while loc:
            parts.insert(0, loc.name)
            loc = locations.get(loc.parent_id) if loc.parent_id else None
        return " > ".join(parts)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "Name", "Description", "Location", "Category", "Tags",
        "Quantity", "Purchase Price ($)", "Purchase Date",
        "Serial Number", "Model Number", "Notes", "Custom Fields",
        "Image Path", "Documents",
    ])

    for item in items:
        writer.writerow([
            item.id,
            item.name,
            item.description or "",
            loc_path(item.location_id),
            f"{item.category.icon or ''} {item.category.name}".strip() if item.category else "",
            ", ".join(t.name for t in item.tags),
            item.quantity,
            f"{item.purchase_price:.2f}" if item.purchase_price else "",
            item.purchase_date or "",
            item.serial_number or "",
            item.model_number or "",
            item.notes or "",
            "; ".join(f"{cf.key}: {cf.value or ''}" for cf in item.custom_fields),
            item.image_path or "",
            len(item.documents),
        ])

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"homeasset_items_{timestamp}.csv"
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Data Management ────────────────────────────────────────────────────────────

@router.delete("/wipe")
def wipe_all_data(db: Session = Depends(get_db)):
    from ..models import CustomField, Document, MaintenanceSchedule, item_tags
    # Explicitly delete child entities to clean up any orphaned data
    db.query(CustomField).delete()
    db.query(Document).delete()
    db.query(MaintenanceSchedule).delete()
    db.execute(item_tags.delete())
    # Delete parent entities
    db.query(Item).delete()
    db.query(Tag).delete()
    db.commit()
    return {"ok": True}

@router.post("/import")
async def import_items_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from ..models import Location, Category, Tag, CustomField
    
    content = await file.read()
    try:
        decoded_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid CSV encoding. Must be UTF-8.")
    
    csv_reader = csv.DictReader(io.StringIO(decoded_content))
    
    locations = {loc.name: loc for loc in db.query(Location).all()}
    categories = {cat.name: cat for cat in db.query(Category).all()}
    tags_by_name = {t.name: t for t in db.query(Tag).all()}

    items_to_add = []
    
    for row in csv_reader:
        loc_path_str = row.get("Location", "")
        loc_id = None
        if loc_path_str:
            last_loc_name = loc_path_str.split(" > ")[-1]
            if last_loc_name in locations:
                loc_id = locations[last_loc_name].id

        cat_str = row.get("Category", "")
        cat_id = None
        if cat_str:
            for c_name, c_obj in categories.items():
                if c_name in cat_str:
                    cat_id = c_obj.id
                    break

        item_tags = []
        tags_str = row.get("Tags", "")
        if tags_str:
            tag_names = [t.strip() for t in tags_str.split(",") if t.strip()]
            for tn in tag_names:
                if tn in tags_by_name:
                    item_tags.append(tags_by_name[tn])
                else:
                    new_tag = Tag(name=tn)
                    db.add(new_tag)
                    db.commit()
                    db.refresh(new_tag)
                    tags_by_name[tn] = new_tag
                    item_tags.append(new_tag)

        qty = 1
        qty_str = row.get("Quantity", "1")
        if qty_str and qty_str.isdigit() and int(qty_str) > 0:
            qty = int(qty_str)

        price = None
        price_str = row.get("Purchase Price ($)", "").replace("$", "").replace(",", "")
        if price_str:
            try: 
                price = float(price_str)
            except ValueError: 
                pass
            
        purchase_date_val = row.get("Purchase Date", "")
        if purchase_date_val:
            try:
                purchase_date_val = datetime.strptime(purchase_date_val, "%Y-%m-%d").date()
            except ValueError:
                purchase_date_val = None
        else:
            purchase_date_val = None

        new_item = Item(
            name=row.get("Name", "Unnamed Item"),
            description=row.get("Description", "") or None,
            location_id=loc_id,
            category_id=cat_id,
            quantity=qty,
            purchase_price=price,
            purchase_date=purchase_date_val,
            serial_number=row.get("Serial Number", "") or None,
            model_number=row.get("Model Number", "") or None,
            notes=row.get("Notes", "") or None,
            image_path=row.get("Image Path", "") or None,
        )
        new_item.tags = item_tags

        opts_str = row.get("Custom Fields", "")
        if opts_str:
            pairs = [p.strip() for p in opts_str.split(";") if p.strip()]
            for pair in pairs:
                if ":" in pair:
                    k, v = pair.split(":", 1)
                    new_item.custom_fields.append(CustomField(key=k.strip(), value=v.strip()))
                    
        items_to_add.append(new_item)

    try:
        db.add_all(items_to_add)
        db.commit()
    except Exception as e:
        db.rollback()
        import traceback
        raise HTTPException(status_code=400, detail=traceback.format_exc())
    
    return {"ok": True, "imported_count": len(items_to_add)}

# ── Single Item ────────────────────────────────────────────────────────────────

@router.get("/{item_id}", response_model=ItemDetail)
def get_item(item_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, item_id)



# ── Create ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=ItemDetail)
def create_item(data: ItemCreate, db: Session = Depends(get_db)):
    item = Item(
        name=data.name,
        description=data.description,
        location_id=data.location_id,
        category_id=data.category_id,
        quantity=data.quantity,
        purchase_price=data.purchase_price,
        purchase_date=data.purchase_date,
        serial_number=data.serial_number,
        model_number=data.model_number,
        notes=data.notes,
    )
    if data.tag_ids:
        item.tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all()
    for cf in data.custom_fields:
        item.custom_fields.append(CustomField(key=cf.key, value=cf.value))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ── Update ─────────────────────────────────────────────────────────────────────

@router.put("/{item_id}", response_model=ItemDetail)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db)):
    item = _get_or_404(db, item_id)
    for field, value in data.model_dump(exclude={"tag_ids", "custom_fields"}, exclude_unset=True).items():
        setattr(item, field, value)
    if data.tag_ids is not None:
        item.tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all()
    if data.custom_fields is not None:
        for cf in list(item.custom_fields):
            db.delete(cf)
        item.custom_fields = [CustomField(key=cf.key, value=cf.value) for cf in data.custom_fields]
    db.commit()
    db.refresh(item)
    return item


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = _get_or_404(db, item_id)
    if item.image_path:
        try:
            os.remove(os.path.join(UPLOAD_DIR, item.image_path))
        except OSError:
            pass
    db.delete(item)
    db.commit()
    return {"ok": True}


# ── Image Upload ───────────────────────────────────────────────────────────────

@router.post("/{item_id}/image")
async def upload_image(item_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    item = _get_or_404(db, item_id)
    if item.image_path:
        try:
            os.remove(os.path.join(UPLOAD_DIR, item.image_path))
        except OSError:
            pass
    ext = os.path.splitext(file.filename or "img.jpg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    async with aiofiles.open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        await f.write(await file.read())
    item.image_path = filename
    db.commit()
    return {"image_path": filename, "url": f"/uploads/{filename}"}


@router.delete("/{item_id}/image")
def delete_image(item_id: int, db: Session = Depends(get_db)):
    item = _get_or_404(db, item_id)
    if item.image_path:
        try:
            os.remove(os.path.join(UPLOAD_DIR, item.image_path))
        except OSError:
            pass
        item.image_path = None
        db.commit()
    return {"ok": True}


# ── Document Upload / Download / Delete ───────────────────────────────────────

@router.post("/{item_id}/documents", response_model=DocumentResponse)
async def upload_document(item_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    item = _get_or_404(db, item_id)
    ext = os.path.splitext(file.filename or "doc")[1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    content = await file.read()
    async with aiofiles.open(os.path.join(DOCUMENT_DIR, filename), "wb") as f:
        await f.write(content)
    doc = Document(
        item_id=item.id,
        filename=filename,
        original_filename=file.filename or filename,
        file_type=file.content_type,
        size=len(content),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{item_id}/documents/{doc_id}/download")
def download_document(item_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.item_id == item_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    filepath = os.path.join(DOCUMENT_DIR, doc.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(filepath, filename=doc.original_filename, media_type=doc.file_type or "application/octet-stream")


@router.delete("/{item_id}/documents/{doc_id}")
def delete_document(item_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.item_id == item_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        os.remove(os.path.join(DOCUMENT_DIR, doc.filename))
    except OSError:
        pass
    db.delete(doc)
    db.commit()
    return {"ok": True}


