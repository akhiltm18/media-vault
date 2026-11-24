import os
import uuid
import mimetypes
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory, abort
from werkzeug.utils import secure_filename
from PIL import Image, ImageOps

import database

app = Flask(__name__)

# Base Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
THUMBNAIL_FOLDER = os.path.join(UPLOAD_FOLDER, 'thumbnails')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMBNAIL_FOLDER, exist_ok=True)

# App Configuration
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['THUMBNAIL_FOLDER'] = THUMBNAIL_FOLDER
# Set max content length to 2GB for large video files
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024

# Supported Extensions
PHOTO_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff'}
VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.ogv'}

# Initialize DB
database.init_db()

def get_file_type(extension):
    ext = extension.lower()
    if ext in PHOTO_EXTENSIONS:
        return 'photo'
    if ext in VIDEO_EXTENSIONS:
        return 'video'
    return None

def create_image_thumbnail(file_path, thumb_path, max_size=(500, 500)):
    try:
        with Image.open(file_path) as img:
            # Transpose according to EXIF orientation
            img = ImageOps.exif_transpose(img)
            width, height = img.size

            # Handle RGBA/transparency for saving as JPEG
            if img.mode in ('RGBA', 'LA', 'P'):
                # Save as PNG or WEBP to preserve transparency, or convert to RGB
                thumb = img.copy()
                thumb.thumbnail(max_size, Image.Resampling.LANCZOS)
                thumb.save(thumb_path, 'WEBP', quality=85)
            else:
                img = img.convert('RGB')
                thumb = img.copy()
                thumb.thumbnail(max_size, Image.Resampling.LANCZOS)
                thumb.save(thumb_path, 'JPEG', quality=85)
            return width, height
    except Exception as e:
        print(f"Error creating thumbnail for {file_path}: {e}")
        return None, None

def format_bytes(size):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/media', methods=['GET'])
def list_media():
    media_type = request.args.get('type') # 'photo', 'video', or None
    search = request.args.get('search', '').strip() or None
    favorites = request.args.get('favorites') == '1'
    sort_by = request.args.get('sort', 'newest')

    items = database.get_media_list(
        media_type=media_type,
        search=search,
        favorites_only=favorites,
        sort_by=sort_by
    )

    for item in items:
        item['formatted_size'] = format_bytes(item['file_size'])
        item['is_favorite'] = bool(item['is_favorite'])
        # Add thumbnail URL for photos if thumbnail exists
        thumb_name = f"thumb_{item['filename']}.webp"
        thumb_jpg = f"thumb_{item['filename']}.jpg"
        if os.path.exists(os.path.join(THUMBNAIL_FOLDER, thumb_name)):
            item['thumbnail_url'] = f"/uploads/thumbnails/{thumb_name}"
        elif os.path.exists(os.path.join(THUMBNAIL_FOLDER, thumb_jpg)):
            item['thumbnail_url'] = f"/uploads/thumbnails/{thumb_jpg}"
        else:
            item['thumbnail_url'] = f"/uploads/{item['filename']}" if item['file_type'] == 'photo' else None

        item['url'] = f"/uploads/{item['filename']}"

    return jsonify({'success': True, 'items': items})

@app.route('/api/upload', methods=['POST'])
def upload_files():
    if 'files[]' not in request.files and 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    uploaded_files = request.files.getlist('files[]') or [request.files['file']]
    results = []
    errors = []

    for file in uploaded_files:
        if not file or file.filename == '':
            continue

        orig_filename = secure_filename(file.filename)
        if not orig_filename:
            orig_filename = f"file_{uuid.uuid4().hex[:8]}"

        _, ext = os.path.splitext(orig_filename)
        ext = ext.lower()
        file_type = get_file_type(ext)

        if not file_type:
            errors.append(f"Skipped {orig_filename}: unsupported format.")
            continue

        unique_prefix = uuid.uuid4().hex[:10]
        stored_filename = f"{unique_prefix}_{orig_filename}"
        file_path = os.path.join(UPLOAD_FOLDER, stored_filename)

        file.save(file_path)
        file_size = os.path.getsize(file_path)
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'image/jpeg' if file_type == 'photo' else 'video/mp4'

        width, height = None, None
        if file_type == 'photo':
            thumb_path = os.path.join(THUMBNAIL_FOLDER, f"thumb_{stored_filename}.webp")
            width, height = create_image_thumbnail(file_path, thumb_path)

        media_id = database.add_media(
            filename=stored_filename,
            original_name=orig_filename,
            file_type=file_type,
            mime_type=mime_type,
            file_size=file_size,
            width=width,
            height=height
        )

        results.append({
            'id': media_id,
            'filename': stored_filename,
            'original_name': orig_filename,
            'file_type': file_type,
            'file_size': file_size,
            'formatted_size': format_bytes(file_size)
        })

    return jsonify({
        'success': True,
        'uploaded': results,
        'errors': errors
    })

@app.route('/api/media/<int:media_id>/favorite', methods=['POST'])
def toggle_fav(media_id):
    new_status = database.toggle_favorite(media_id)
    return jsonify({'success': True, 'is_favorite': new_status})

@app.route('/api/media/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    filename = database.delete_media_record(media_id)
    if not filename:
        return jsonify({'error': 'Item not found'}), 404

    # Remove main file
    main_file = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(main_file):
        try:
            os.remove(main_file)
        except Exception as e:
            print(f"Error removing {main_file}: {e}")

    # Remove thumbnail if exists
    for t_ext in ['.webp', '.jpg']:
        thumb_file = os.path.join(THUMBNAIL_FOLDER, f"thumb_{filename}{t_ext}")
        if os.path.exists(thumb_file):
            try:
                os.remove(thumb_file)
            except Exception as e:
                print(f"Error removing {thumb_file}: {e}")

    return jsonify({'success': True, 'id': media_id})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = database.get_stats()
    stats['formatted_total_size'] = format_bytes(stats.get('total_size', 0))
    return jsonify({'success': True, 'stats': stats})

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/uploads/thumbnails/<path:filename>')
def serve_thumbnail(filename):
    return send_from_directory(THUMBNAIL_FOLDER, filename)

if __name__ == '__main__':
    print("Starting Media Vault server on http://127.0.0.1:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)
