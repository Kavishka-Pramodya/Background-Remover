/**
 * utils.js — Shared utility functions
 */
const Utils = (() => {
    // Track object URLs for cleanup
    const _objectURLs = new Set();

    /**
     * Create a browser object URL and track it for later cleanup.
     */
    function createObjectURL(blob) {
        const url = URL.createObjectURL(blob);
        _objectURLs.add(url);
        return url;
    }

    /**
     * Revoke a specific object URL.
     */
    function revokeObjectURL(url) {
        if (url && _objectURLs.has(url)) {
            URL.revokeObjectURL(url);
            _objectURLs.delete(url);
        }
    }

    /**
     * Revoke all tracked object URLs.
     */
    function revokeAllObjectURLs() {
        _objectURLs.forEach(url => URL.revokeObjectURL(url));
        _objectURLs.clear();
    }

    /**
     * Get an element by ID, throw if not found.
     */
    function $(id) {
        const el = document.getElementById(id);
        if (!el) console.warn(`Element #${id} not found`);
        return el;
    }

    /**
     * Format file size in human-readable units.
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    }

    /**
     * Truncate a filename for display.
     */
    function truncateFilename(name, maxLength = 30) {
        if (name.length <= maxLength) return name;
        const ext = name.split('.').pop();
        const base = name.slice(0, maxLength - ext.length - 4);
        return `${base}...${ext}`;
    }

    /**
     * Show an element (remove .hidden class).
     */
    function show(el) {
        if (el) el.classList.remove('hidden');
    }

    /**
     * Hide an element (add .hidden class).
     */
    function hide(el) {
        if (el) el.classList.add('hidden');
    }

    /**
     * Toggle visibility.
     */
    function toggle(el, visible) {
        if (el) el.classList.toggle('hidden', !visible);
    }

    /**
     * Show a toast notification.
     */
    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'toast--error' : type === 'success' ? 'toast--success' : ''}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

    /**
     * Validate an image file on the client side.
     * Returns { valid: true } or { valid: false, error: string }.
     */
    function validateImageFile(file) {
        const MAX_SIZE_MB = 10;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
        const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
        const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

        if (!file) {
            return { valid: false, error: 'No file selected.' };
        }

        // Check extension
        const fileName = file.name.toLowerCase();
        const hasValidExt = ACCEPTED_EXTENSIONS.some(ext => fileName.endsWith(ext));
        if (!hasValidExt) {
            return { valid: false, error: `Unsupported file type. Please upload a JPEG, PNG, or WebP image.` };
        }

        // Check MIME type
        if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
            return { valid: false, error: `Unsupported file type "${file.type}". Please upload a JPEG, PNG, or WebP image.` };
        }

        // Check size
        if (file.size > MAX_SIZE_BYTES) {
            return { valid: false, error: `File is too large (${formatFileSize(file.size)}). Maximum size is ${MAX_SIZE_MB} MB.` };
        }

        return { valid: true };
    }

    /**
     * Load an image file and return its natural dimensions.
     */
    function getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not read image dimensions.'));
            };
            img.src = url;
        });
    }

    /**
     * Escape HTML special characters for safe template rendering.
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    return {
        $,
        createObjectURL,
        revokeObjectURL,
        revokeAllObjectURLs,
        formatFileSize,
        truncateFilename,
        show,
        hide,
        toggle,
        showToast,
        validateImageFile,
        getImageDimensions,
        escapeHtml
    };
})();
