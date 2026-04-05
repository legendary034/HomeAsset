from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime


# ── Tags ──────────────────────────────────────────────────────────────────────

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BulkTags(BaseModel):
    names: List[str]

class BulkTagDelete(BaseModel):
    tag_ids: List[int]

class BulkTagAssociate(BaseModel):
    tag_ids: List[int]
    item_ids: List[int]


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#22d3ee"
    icon: Optional[str] = "🏷️"

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BulkCategoryAssociate(BaseModel):
    category_id: int
    item_ids: List[int]


# ── Locations ─────────────────────────────────────────────────────────────────

class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = "📦"
    color: Optional[str] = "#6366f1"

class LocationCreate(LocationBase):
    pass

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class LocationNode(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    item_count: int = 0
    children: List[LocationNode] = []
    model_config = ConfigDict(from_attributes=True)

LocationNode.model_rebuild()

class LocationFlat(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── Custom Fields ─────────────────────────────────────────────────────────────

class CustomFieldCreate(BaseModel):
    key: str
    value: Optional[str] = None

class CustomFieldResponse(CustomFieldCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: int
    original_filename: str
    file_type: Optional[str] = None
    size: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Maintenance ───────────────────────────────────────────────────────────────

class MaintenanceCreate(BaseModel):
    title: str
    interval_days: Optional[int] = None
    last_serviced: Optional[date] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None

class MaintenanceResponse(MaintenanceCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ── Items ─────────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location_id: Optional[int] = None
    category_id: Optional[int] = None
    quantity: int = 1
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    serial_number: Optional[str] = None
    model_number: Optional[str] = None
    notes: Optional[str] = None
    tag_ids: List[int] = []
    custom_fields: List[CustomFieldCreate] = []

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location_id: Optional[int] = None
    category_id: Optional[int] = None
    quantity: Optional[int] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    serial_number: Optional[str] = None
    model_number: Optional[str] = None
    notes: Optional[str] = None
    tag_ids: Optional[List[int]] = None
    custom_fields: Optional[List[CustomFieldCreate]] = None

class ItemSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    quantity: int
    image_path: Optional[str] = None
    location_id: Optional[int] = None
    category_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    tags: List[TagResponse] = []
    location: Optional[LocationFlat] = None
    category: Optional[CategoryResponse] = None
    model_config = ConfigDict(from_attributes=True)

class ItemDetail(ItemSummary):
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    serial_number: Optional[str] = None
    model_number: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: List[CustomFieldResponse] = []
    documents: List[DocumentResponse] = []
    maintenance_schedules: List[MaintenanceResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ── Stats ─────────────────────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_items: int
    total_locations: int
    total_categories: int
    total_tags: int
