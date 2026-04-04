import sys
sys.path.append("c:/Users/pmitchell/.gemini/antigravity/scratch/HomeAsset")
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Item, Tag, Category, Location, CustomField
from datetime import datetime
import csv, io

engine = create_engine("sqlite:///./sql_app.db")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

with open("test.csv", "r", encoding="utf-8") as f:
    decoded_content = f.read()

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

db.add_all(items_to_add)
db.commit()
print("Success!")
