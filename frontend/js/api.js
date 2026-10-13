/**
 * api.js — Backend API service module
 * 
 * All fetch() calls to the backend are centralised here.
 * Returns normalised responses and handles network/server errors.
 */
const ApiService = (() => {
    // Production Render Backend URL (or configurable via window.API_BASE_URL)
    const PROD_URL = window.API_BASE_URL || 'https://background-remover-mk8t.onrender.com';
    
    function getBaseURL() {
        // 1. If Store Owner has local companion engine running, prioritize it!
        if (typeof AdminManager !== 'undefined' && AdminManager.isLocalEngineActive()) {
            return 'http://127.0.0.1:8000';
        }
        // 2. If running on localhost in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://127.0.0.1:8000';
        }
        // 3. Fallback to Cloud deployment
        return PROD_URL;
    }

    /** Track the current AbortController for cancellable requests */
    let _currentAbort = null;

    /**
     * Internal fetch wrapper with error normalisation.
     */
    async function _request(path, options = {}) {
        const url = `${getBaseURL()}${path}`;
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorBody;
                try {
                    errorBody = await response.json();
                } catch {
                    errorBody = { message: response.statusText };
                }
                const error = new Error(errorBody.message || `Server error (${response.status})`);
                error.status = response.status;
                error.serverError = errorBody;
                throw error;
            }
            return response;
        } catch (err) {
            if (err.name === 'AbortError') {
                const abortErr = new Error('Request was cancelled.');
                abortErr.cancelled = true;
                throw abortErr;
            }
            if (!err.status) {
                // Network error
                const msg = isLocal
                    ? 'Cannot connect to the local server. Please ensure the backend is running on port 8000.'
                    : 'Cannot connect to the cloud server. If it was sleeping, it takes ~30 seconds to wake up. Please click Try Again in a moment.';
                const netErr = new Error(msg);
                netErr.networkError = true;
                throw netErr;
            }
            throw err;
        }
    }

    /**
     * GET /api/health
     */
    async function checkHealth() {
        const res = await _request('/api/health');
        return res.json();
    }

    /**
     * GET /api/templates
     */
    async function getTemplates() {
        const res = await _request('/api/templates');
        return res.json();
    }

    /**
     * POST /api/process — upload and process an image.
     * @param {File} file - The image file
     * @param {Object} settings - Processing settings
     * @returns {Promise<Object>} Processing result metadata
     */
    async function processImage(file, settings = {}) {
        // Cancel any existing processing request
        cancelProcessing();

        _currentAbort = new AbortController();

        const formData = new FormData();
        formData.append('image', file);

        if (settings.template_id) formData.append('template_id', settings.template_id);
        if (settings.scale != null) formData.append('scale', String(settings.scale));
        if (settings.position_x != null) formData.append('position_x', String(settings.position_x));
        if (settings.position_y != null) formData.append('position_y', String(settings.position_y));
        if (settings.shadow_intensity != null) formData.append('shadow_intensity', String(settings.shadow_intensity));
        if (settings.shadow_softness != null) formData.append('shadow_softness', String(settings.shadow_softness));
        if (settings.output_format) formData.append('output_format', settings.output_format);

        // Do NOT set Content-Type header manually for multipart/form-data
        const res = await _request('/api/process', {
            method: 'POST',
            body: formData,
            signal: _currentAbort.signal
        });

        _currentAbort = null;
        return res.json();
    }

    /**
     * POST /api/reprocess — fast re-compositing of already-extracted cutout.
     */
    async function reprocessImage(resultId, settings = {}, updatedCutoutBlob = null) {
        cancelProcessing();
        _currentAbort = new AbortController();

        const formData = new FormData();
        formData.append('result_id', resultId);
        if (settings.template_id) formData.append('template_id', settings.template_id);
        if (settings.scale != null) formData.append('scale', String(settings.scale));
        if (settings.position_x != null) formData.append('position_x', String(settings.position_x));
        if (settings.position_y != null) formData.append('position_y', String(settings.position_y));
        if (settings.shadow_intensity != null) formData.append('shadow_intensity', String(settings.shadow_intensity));
        if (settings.shadow_softness != null) formData.append('shadow_softness', String(settings.shadow_softness));
        if (settings.output_format) formData.append('output_format', settings.output_format);
        if (updatedCutoutBlob) {
            formData.append('updated_cutout', updatedCutoutBlob, 'edited_cutout.png');
        }

        const res = await _request('/api/reprocess', {
            method: 'POST',
            body: formData,
            signal: _currentAbort.signal
        });

        _currentAbort = null;
        return res.json();
    }

    /**
     * Cancel the current processing request.
     */
    function cancelProcessing() {
        if (_currentAbort) {
            _currentAbort.abort();
            _currentAbort = null;
        }
    }

    /**
     * Get the preview image URL for a result.
     */
    function getPreviewURL(resultId) {
        return `${getBaseURL()}/api/results/${resultId}/preview`;
    }

    /**
     * Get the raw cutout image URL for eraser / touchup tool.
     */
    function getCutoutURL(resultId) {
        return `${getBaseURL()}/api/results/${resultId}/cutout`;
    }

    /**
     * Get the download URL for a result.
     */
    function getDownloadURL(resultId, format = 'png') {
        return `${getBaseURL()}/api/results/${resultId}/download?format=${format}`;
    }

    /**
     * Get the template preview URL with full backend domain.
     */
    function getTemplatePreviewURL(templateId) {
        return `${getBaseURL()}/api/templates/${templateId}/preview`;
    }

    /**
     * Trigger file download via a hidden link.
     */
    async function downloadResult(resultId, format = 'png') {
        const url = getDownloadURL(resultId, format);
        const a = document.createElement('a');
        a.href = url;
        a.download = `product_studio_${resultId}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    return {
        checkHealth,
        getTemplates,
        processImage,
        reprocessImage,
        cancelProcessing,
        getPreviewURL,
        getCutoutURL,
        getDownloadURL,
        getTemplatePreviewURL,
        downloadResult
    };
})();
