from sqlalchemy import Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# Many-to-many: items <-> tags
item_tags = Table(
    "item_tags",
    Base.metadata,
    Column("item_id", Integer, ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    icon = Column(String(10), default="📦")
    color = Column(String(7), default="#6366f1")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    parent = relationship("Location", remote_side=[id], back_populates="children")
    children = relationship("Location", back_populates="parent", cascade="all, delete-orphan")
    items = relationship("Item", back_populates="location")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#22d3ee")
    icon = Column(String(10), default="🏷️")
    created_at = Column(DateTime, server_default=func.now())

    items = relationship("Item", back_populates="category")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)

    items = relationship("Item", secondary=item_tags, back_populates="tags")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1)
    purchase_price = Column(Float, nullable=True)
    purchase_date = Column(Date, nullable=True)
    serial_number = Column(String(255), nullable=True)
    model_number = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    image_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    location = relationship("Location", back_populates="items")
    category = relationship("Category", back_populates="items")
    tags = relationship("Tag", secondary=item_tags, back_populates="items")
    custom_fields = relationship("CustomField", back_populates="item", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="item", cascade="all, delete-orphan")
    maintenance_schedules = relationship("MaintenanceSchedule", back_populates="item", cascade="all, delete-orphan")


class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=True)

    item = relationship("Item", back_populates="custom_fields")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=True)
    size = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    item = relationship("Item", back_populates="documents")


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    interval_days = Column(Integer, nullable=True)
    last_serviced = Column(Date, nullable=True)
    next_due = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    item = relationship("Item", back_populates="maintenance_schedules")
