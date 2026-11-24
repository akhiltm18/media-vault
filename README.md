# 📸 MediaVault - Personal Photo & Video Storage

A sleek, lightweight, self-hosted web application for storing, organizing, previewing, and downloading your personal photos and videos. Built with a simple and robust Python (Flask) framework, SQLite, and modern vanilla JavaScript/CSS.

---

## ✨ Features

- **Upload Button & Drag-and-Drop**: Easily upload multiple photos and videos at once with real-time percentage progress tracking.
- **Support for Media Types**:
  - **Photos**: JPG, PNG, WEBP, GIF, SVG, BMP, TIFF (automatic thumbnail generation with EXIF orientation correction).
  - **Videos**: MP4, WebM, MOV, MKV, AVI, etc. (with HTML5 streaming and partial content / range request support).
- **Interactive Lightbox Viewer**:
  - Fullscreen high-resolution image viewer with next/prev keyboard navigation (Arrow keys).
  - Built-in video player with play/pause, seek, volume, and fullscreen controls.
- **Organization & Filters**:
  - Filter by **All Media**, **Photos**, **Videos**, or **Favorites** (⭐).
  - Real-time search bar to filter by file name.
  - Sorting options: Newest first, Oldest first, Largest file size, Name (A-Z).
- **File Actions**:
  - Quick download of original uncompressed files.
  - Favorite toggle (⭐).
  - Copy direct media URL to clipboard.
  - Delete with confirmation.
- **Storage & Statistics**: Live dashboard displaying total item count, photo count, video count, and total disk space used.
- **Zero Complex Build Tools**: Runs directly with Python. No Node.js build step or complex database setup required.

---

## 🚀 Quick Start

### 1. Launch the Server

Navigate to the project directory and run the launcher script:

```bash
cd /home/akhil/.gemini/antigravity/scratch/media-vault
./run.sh
```

Or manually with Python:

```bash
cd /home/akhil/.gemini/antigravity/scratch/media-vault
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python3 app.py
```

### 2. Open in Your Browser

Open your web browser and go to:
[http://localhost:5000](http://localhost:5000)

---

## 📁 Project Structure

```text
media-vault/
├── app.py                  # Main Flask application & REST API endpoints
├── database.py             # SQLite database layer for media metadata
├── requirements.txt        # Python package dependencies (Flask, Pillow)
├── run.sh                  # One-click startup script
├── templates/
│   └── index.html          # Modern HTML5 responsive user interface
├── static/
│   ├── css/
│   │   └── style.css       # Custom modern dark-theme styles
│   └── js/
│       └── app.js          # Client-side logic (drag-and-drop, upload, lightbox)
├── uploads/                # Stores full-resolution uploaded photos & videos
│   └── thumbnails/         # Auto-generated lightweight thumbnails
└── gallery.db              # SQLite database (auto-generated on startup)
```

---

## ⚙️ Configuration

In `app.py`, you can customize settings:
- **Max Upload Size**: Defaults to 2 GB (`app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024`).
- **Server Port**: Defaults to `5000`. You can change `port=5000` in the `app.run(...)` call.
