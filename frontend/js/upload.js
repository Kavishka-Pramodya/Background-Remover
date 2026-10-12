/**
 * upload.js — Upload & drag-drop logic
 */
const UploadManager = (() => {
    let _onFileAccepted = null;

    function init(onFileAccepted) {
        _onFileAccepted = onFileAccepted;

        const uploadZone = Utils.$('uploadZone');
        const browseBtn = Utils.$('browseBtn');
        const fileInput = Utils.$('fileInput');
        const uploadErrorRetry = Utils.$('uploadErrorRetry');

        if (!uploadZone || !fileInput) return;

        // Click on zone or browse button → open file picker
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        uploadZone.addEventListener('click', (e) => {
            // Only trigger if clicking the zone itself (not child buttons)
            if (e.target === uploadZone || e.target.closest('.upload-zone__content')) {
                fileInput.click();
            }
        });

        uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                _handleFile(fileInput.files[0]);
            }
        });

        // Drag and drop
        uploadZone.addEventListener('dragenter', _onDragEnter);
        uploadZone.addEventListener('dragover', _onDragOver);
        uploadZone.addEventListener('dragleave', _onDragLeave);
        uploadZone.addEventListener('drop', _onDrop);

        // Retry button
        if (uploadErrorRetry) {
            uploadErrorRetry.addEventListener('click', (e) => {
                e.stopPropagation();
                resetUploadUI();
            });
        }
    }

    function _onDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        Utils.$('uploadZone').classList.add('drag-over');
    }

    function _onDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function _onDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        // Only remove if leaving the upload zone itself
        const zone = Utils.$('uploadZone');
        if (!zone.contains(e.relatedTarget)) {
            zone.classList.remove('drag-over');
        }
    }

    function _onDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        const zone = Utils.$('uploadZone');
        zone.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            _handleFile(files[0]);
        }
    }

    function _handleFile(file) {
        // Client-side validation
        const validation = Utils.validateImageFile(file);

        if (!validation.valid) {
            showUploadError(validation.error);
            return;
        }

        // Show loading state briefly
        showUploadProgress('Reading image...');

        // Get dimensions and notify callback
        Utils.getImageDimensions(file)
            .then(dimensions => {
                if (_onFileAccepted) {
                    _onFileAccepted(file, dimensions);
                }
            })
            .catch(() => {
                showUploadError('Could not read this image. The file may be corrupt.');
            });
    }

    function showUploadProgress(message) {
        Utils.hide(Utils.$('uploadContent'));
        Utils.hide(Utils.$('uploadError'));
        Utils.show(Utils.$('uploadProgress'));

        const statusText = Utils.$('uploadStatusText');
        if (statusText) statusText.textContent = message;
    }

    function showUploadError(message) {
        Utils.hide(Utils.$('uploadContent'));
        Utils.hide(Utils.$('uploadProgress'));
        Utils.show(Utils.$('uploadError'));

        const errorText = Utils.$('uploadErrorText');
        if (errorText) errorText.textContent = message;
    }

    function resetUploadUI() {
        Utils.show(Utils.$('uploadContent'));
        Utils.hide(Utils.$('uploadProgress'));
        Utils.hide(Utils.$('uploadError'));

        // Reset file input so re-selecting same file triggers change
        const fileInput = Utils.$('fileInput');
        if (fileInput) fileInput.value = '';
    }

    return {
        init,
        showUploadProgress,
        showUploadError,
        resetUploadUI
    };
})();
