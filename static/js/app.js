/**
 * MediaVault - Interactive Frontend Logic
 */

let state = {
    items: [],
    filter: 'all',
    search: '',
    sort: 'newest',
    currentIndex: -1
};

// DOM References
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const mediaGrid = document.getElementById('media-grid');
const emptyState = document.getElementById('empty-state');
const dropOverlay = document.getElementById('drop-zone-overlay');
const progressCard = document.getElementById('upload-progress-card');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const sortSelect = document.getElementById('sort-select');
const filterTabs = document.querySelectorAll('.tab-btn');
const toastContainer = document.getElementById('toast-container');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statStorage = document.getElementById('stat-storage');
const countAll = document.getElementById('count-all');
const countPhotos = document.getElementById('count-photos');
const countVideos = document.getElementById('count-videos');
const countFavs = document.getElementById('count-favs');

// Modal Elements
const modal = document.getElementById('media-modal');
const modalImage = document.getElementById('modal-image');
const modalVideo = document.getElementById('modal-video');
const modalFilename = document.getElementById('modal-filename');
const modalFilemeta = document.getElementById('modal-filemeta');
const modalTypeBadge = document.getElementById('modal-type-badge');
const modalFavBtn = document.getElementById('modal-fav-btn');
const modalDownloadBtn = document.getElementById('modal-download-btn');
const modalCopyBtn = document.getElementById('modal-copy-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalPrevBtn = document.getElementById('modal-prev-btn');
const modalNextBtn = document.getElementById('modal-next-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchStats();
    loadMedia();
});

function setupEventListeners() {
    // Upload Button & File Input
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
        }
    });

    // Drag & Drop
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dropOverlay.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dropOverlay.classList.add('hidden');
            dragCounter = 0;
        }
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.add('hidden');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    });

    // Filter Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.filter = tab.dataset.filter;
            loadMedia();
        });
    });

    // Search
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        state.search = e.target.value.trim();
        searchClear.classList.toggle('hidden', state.search.length === 0);
        debounceTimer = setTimeout(() => {
            loadMedia();
        }, 300);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        searchClear.classList.add('hidden');
        loadMedia();
    });

    // Sort
    sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        loadMedia();
    });

    // Modal Events
    modalCloseBtn.addEventListener('click', closeModal);
    modalPrevBtn.addEventListener('click', showPrevMedia);
    modalNextBtn.addEventListener('click', showNextMedia);

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-body')) {
            closeModal();
        }
    });

    window.addEventListener('keydown', (e) => {
        if (modal.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') showPrevMedia();
        if (e.key === 'ArrowRight') showNextMedia();
    });

    modalFavBtn.addEventListener('click', () => {
        if (state.currentIndex >= 0 && state.items[state.currentIndex]) {
            toggleFavorite(state.items[state.currentIndex].id);
        }
    });

    modalCopyBtn.addEventListener('click', () => {
        if (state.currentIndex >= 0 && state.items[state.currentIndex]) {
            const item = state.items[state.currentIndex];
            const fullUrl = window.location.origin + item.url;
            navigator.clipboard.writeText(fullUrl).then(() => {
                showToast('Direct URL copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Could not copy link', 'error');
            });
        }
    });

    modalDeleteBtn.addEventListener('click', () => {
        if (state.currentIndex >= 0 && state.items[state.currentIndex]) {
            const item = state.items[state.currentIndex];
            if (confirm(`Are you sure you want to delete "${item.original_name}"?`)) {
                deleteMedia(item.id, true);
            }
        }
    });
}

// --- Fetch & Render Media ---
async function loadMedia() {
    let url = `/api/media?sort=${encodeURIComponent(state.sort)}`;
    if (state.filter === 'photo') url += '&type=photo';
    if (state.filter === 'video') url += '&type=video';
    if (state.filter === 'favorite') url += '&favorites=1';
    if (state.search) url += `&search=${encodeURIComponent(state.search)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            state.items = data.items;
            renderMediaGrid();
        }
    } catch (err) {
        console.error('Error fetching media:', err);
        showToast('Failed to load media items', 'error');
    }
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (data.success && data.stats) {
            const s = data.stats;
            statTotal.textContent = `${s.total_items} items`;
            statStorage.textContent = `${s.formatted_total_size} used`;
            countAll.textContent = s.total_items;
            countPhotos.textContent = s.photo_count;
            countVideos.textContent = s.video_count;
            countFavs.textContent = s.favorite_count;
        }
    } catch (err) {
        console.error('Error fetching stats:', err);
    }
}

function renderMediaGrid() {
    mediaGrid.innerHTML = '';

    if (state.items.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    state.items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.id = item.id;

        const isVideo = item.file_type === 'video';

        let mediaThumbHtml = '';
        if (isVideo) {
            mediaThumbHtml = `
                <div class="media-thumb-box">
                    <span class="media-type-tag">VIDEO</span>
                    ${item.is_favorite ? '<div class="media-fav-badge">★</div>' : ''}
                    <div class="video-play-overlay">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </div>
                    <video class="media-thumb" src="${item.url}#t=0.5" preload="metadata"></video>
                </div>
            `;
        } else {
            mediaThumbHtml = `
                <div class="media-thumb-box">
                    <span class="media-type-tag">PHOTO</span>
                    ${item.is_favorite ? '<div class="media-fav-badge">★</div>' : ''}
                    <img class="media-thumb" src="${item.thumbnail_url || item.url}" alt="${item.original_name}" loading="lazy">
                </div>
            `;
        }

        const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        card.innerHTML = `
            ${mediaThumbHtml}
            <div class="media-details">
                <div class="media-title-row">
                    <span class="media-title" title="${item.original_name}">${escapeHtml(item.original_name)}</span>
                </div>
                <div class="media-meta">
                    <span>${item.formatted_size}</span>
                    <span>•</span>
                    <span>${dateStr}</span>
                </div>
                <div class="media-actions-bar">
                    <button class="action-icon-btn ${item.is_favorite ? 'is-fav' : ''}" data-action="favorite" title="Favorite">
                        ★
                    </button>
                    <a href="${item.url}" class="action-icon-btn" data-action="download" download="${item.original_name}" title="Download">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </a>
                    <button class="action-icon-btn btn-delete" data-action="delete" title="Delete">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Card Click opens Modal
        card.addEventListener('click', (e) => {
            // Prevent opening modal if clicked on action buttons
            if (e.target.closest('.media-actions-bar')) return;
            openModal(index);
        });

        // Quick Actions inside card
        const favBtn = card.querySelector('[data-action="favorite"]');
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(item.id);
        });

        const deleteBtn = card.querySelector('[data-action="delete"]');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${item.original_name}"?`)) {
                deleteMedia(item.id);
            }
        });

        mediaGrid.appendChild(card);
    });
}

// --- Upload Handler with Progress ---
function handleFileUpload(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    progressCard.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = `Uploading ${files.length} file(s)...`;

    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            progressText.textContent = `Uploading ${files.length} file(s) (${pct}%)...`;
        }
    };

    xhr.onload = () => {
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressText.textContent = 'Processing files...';

        setTimeout(() => {
            progressCard.classList.add('hidden');
            fileInput.value = ''; // reset

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        const count = response.uploaded.length;
                        showToast(`Successfully uploaded ${count} file(s)!`, 'success');
                        if (response.errors && response.errors.length > 0) {
                            response.errors.forEach(err => showToast(err, 'error'));
                        }
                        loadMedia();
                        fetchStats();
                    }
                } catch (e) {
                    showToast('Upload finished, refreshing...', 'success');
                    loadMedia();
                    fetchStats();
                }
            } else {
                showToast(`Upload failed (Status: ${xhr.status})`, 'error');
            }
        }, 500);
    };

    xhr.onerror = () => {
        progressCard.classList.add('hidden');
        fileInput.value = '';
        showToast('Upload failed due to network error.', 'error');
    };

    xhr.send(formData);
}

// --- Actions (Favorite, Delete) ---
async function toggleFavorite(mediaId) {
    try {
        const res = await fetch(`/api/media/${mediaId}/favorite`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            // Update local state
            const item = state.items.find(i => i.id === mediaId);
            if (item) {
                item.is_favorite = data.is_favorite;
                // If in favorites view and unfavorited, reload
                if (state.filter === 'favorite' && !data.is_favorite) {
                    loadMedia();
                } else {
                    renderMediaGrid();
                }
            }
            if (state.currentIndex >= 0 && state.items[state.currentIndex]?.id === mediaId) {
                updateModalFavState(data.is_favorite);
            }
            fetchStats();
        }
    } catch (err) {
        console.error('Error toggling favorite:', err);
    }
}

async function deleteMedia(mediaId, fromModal = false) {
    try {
        const res = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Item deleted successfully', 'success');
            if (fromModal) {
                closeModal();
            }
            loadMedia();
            fetchStats();
        }
    } catch (err) {
        console.error('Error deleting item:', err);
        showToast('Failed to delete item', 'error');
    }
}

// --- Lightbox / Modal ---
function openModal(index) {
    if (index < 0 || index >= state.items.length) return;
    state.currentIndex = index;
    const item = state.items[index];

    modalFilename.textContent = item.original_name;
    const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
    });
    modalFilemeta.textContent = `${item.formatted_size} • ${dateStr}`;
    modalTypeBadge.textContent = item.file_type.toUpperCase();

    modalDownloadBtn.href = item.url;
    modalDownloadBtn.download = item.original_name;

    updateModalFavState(item.is_favorite);

    if (item.file_type === 'video') {
        modalImage.classList.add('hidden');
        modalImage.src = '';
        modalVideo.classList.remove('hidden');
        modalVideo.src = item.url;
        modalVideo.play().catch(() => {});
    } else {
        modalVideo.classList.add('hidden');
        modalVideo.pause();
        modalVideo.src = '';
        modalImage.classList.remove('hidden');
        modalImage.src = item.url;
    }

    modalPrevBtn.style.display = state.items.length > 1 ? 'flex' : 'none';
    modalNextBtn.style.display = state.items.length > 1 ? 'flex' : 'none';

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function updateModalFavState(isFav) {
    modalFavBtn.classList.toggle('is-fav', Boolean(isFav));
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    modalVideo.pause();
    modalVideo.src = '';
    modalImage.src = '';
    state.currentIndex = -1;
}

function showPrevMedia() {
    if (state.items.length <= 1) return;
    let newIndex = state.currentIndex - 1;
    if (newIndex < 0) newIndex = state.items.length - 1;
    openModal(newIndex);
}

function showNextMedia() {
    if (state.items.length <= 1) return;
    let newIndex = state.currentIndex + 1;
    if (newIndex >= state.items.length) newIndex = 0;
    openModal(newIndex);
}

// --- Notifications / Toast ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
