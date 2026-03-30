# 🏠 HomeAsset

Self-hosted home inventory system for tracking items stored in bins, tubs, shelves, and any nested location you can imagine.

## Features

- **Hierarchical Locations** — Create locations nested inside other locations (e.g. Garage → Shelf A → Tub 3)
- **Item Tracking** — Name, description, quantity, purchase info, serial/model numbers
- **Photo Uploads** — Attach images to items for quick visual identification
- **Tags** — Add multiple tags to items and search/filter by them
- **Categories** — Group items with custom color-coded categories
- **Custom Fields** — Add any key/value pair to an item (e.g. "Warranty Until: 2027")
- **Document Storage** — Attach PDFs, manuals, and warranty documents to items
- **Powerful Search** — Search by name, description, serial number, notes, or filter by tags
- **No Login Required** — Designed for local network use; no authentication needed
- **Responsive UI** — Works on desktop, tablet, and phone

## Quick Start

### Requirements
- Docker and Docker Compose installed

### Run

```bash
git clone <repo>
cd HomeAsset
docker compose up -d
```

Open **http://localhost:7745** in your browser.

Data is saved to `./data/` (SQLite database + uploads).

### Stop

```bash
docker compose down
```

### Rebuild after changes

```bash
docker compose up -d --build
```

## Data Persistence

All data lives in `./data/`:
- `home_asset.db` — SQLite database
- `uploads/` — Item photos
- `documents/` — Attached documents

Back up and restore by copying the `./data/` directory.

## Configuration

Edit `docker-compose.yml` to change the port (default: `7745`).

## API

The REST API is available at `http://localhost:7745/api/`.  
Interactive docs: `http://localhost:7745/docs`
