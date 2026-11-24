import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gallery.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL UNIQUE,
            original_name TEXT NOT NULL,
            file_type TEXT NOT NULL, -- 'photo' or 'video'
            mime_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            width INTEGER DEFAULT NULL,
            height INTEGER DEFAULT NULL,
            is_favorite INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def add_media(filename, original_name, file_type, mime_type, file_size, width=None, height=None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO media (filename, original_name, file_type, mime_type, file_size, width, height)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (filename, original_name, file_type, mime_type, file_size, width, height))
    media_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return media_id

def get_media_list(media_type=None, search=None, favorites_only=False, sort_by='newest'):
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM media WHERE 1=1"
    params = []

    if media_type and media_type in ('photo', 'video'):
        query += " AND file_type = ?"
        params.append(media_type)

    if favorites_only:
        query += " AND is_favorite = 1"

    if search:
        query += " AND (original_name LIKE ? OR filename LIKE ?)"
        params.append(f"%{search}%")
        params.append(f"%{search}%")

    if sort_by == 'oldest':
        query += " ORDER BY created_at ASC"
    elif sort_by == 'size_desc':
        query += " ORDER BY file_size DESC"
    elif sort_by == 'name_asc':
        query += " ORDER BY original_name ASC"
    else:
        query += " ORDER BY created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_media_by_id(media_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media WHERE id = ?", (media_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def toggle_favorite(media_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE media SET is_favorite = 1 - is_favorite WHERE id = ?", (media_id,))
    conn.commit()
    cursor.execute("SELECT is_favorite FROM media WHERE id = ?", (media_id,))
    row = cursor.fetchone()
    conn.close()
    return bool(row['is_favorite']) if row else False

def delete_media_record(media_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT filename FROM media WHERE id = ?", (media_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    filename = row['filename']
    cursor.execute("DELETE FROM media WHERE id = ?", (media_id,))
    conn.commit()
    conn.close()
    return filename

def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            COUNT(*) as total_items,
            COALESCE(SUM(CASE WHEN file_type = 'photo' THEN 1 ELSE 0 END), 0) as photo_count,
            COALESCE(SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END), 0) as video_count,
            COALESCE(SUM(is_favorite), 0) as favorite_count,
            COALESCE(SUM(file_size), 0) as total_size
        FROM media
    ''')
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {
        'total_items': 0, 'photo_count': 0, 'video_count': 0, 'favorite_count': 0, 'total_size': 0
    }
