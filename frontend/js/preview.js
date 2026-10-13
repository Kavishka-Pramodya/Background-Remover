/**
 * preview.js — Image preview & comparison logic
 */
const PreviewManager = (() => {

    let _originalURL = null;   // Object URL for original image
    let _resultURL = null;     // Server URL for result image
    let _resultId = null;
    let _overlayMode = false;

    function init() {
        const btnCompare = Utils.$('btnCompare');
        const btnCloseComparison = Utils.$('btnCloseComparison');
        const btnToggleComparison = Utils.$('btnToggleComparison');

        if (btnCompare) {
            btnCompare.addEventListener('click', showComparison);
        }
        if (btnCloseComparison) {
            btnCloseComparison.addEventListener('click', hideComparison);
        }
        if (btnToggleComparison) {
            btnToggleComparison.addEventListener('click', toggleComparisonMode);
        }
    }

    /**
     * Show the original image preview.
     */
    function showOriginal(file, dimensions) {
        // Revoke old URL
        if (_originalURL) {
            Utils.revokeObjectURL(_originalURL);
        }

        _originalURL = Utils.createObjectURL(file);

        const img = Utils.$('originalImage');
        const filename = Utils.$('originalFilename');
        const dims = Utils.$('originalDimensions');

        if (img) img.src = _originalURL;
        if (filename) filename.textContent = Utils.truncateFilename(file.name);
        if (dims) dims.textContent = `${dimensions.width} × ${dimensions.height}`;
    }

    /**
     * Show the processed result.
     */
    function showResult(resultData) {
        _resultId = resultData.result_id;
        let targetUrl = resultData.preview_url || resultData.data_url || (resultData.result_id ? ApiService.getPreviewURL(resultData.result_id) : '');
        if (targetUrl && targetUrl.startsWith('/api/')) {
            targetUrl = `${ApiService.getBaseURL()}${targetUrl}`;
        }
        _resultURL = targetUrl;

        const resultCard = Utils.$('previewResult');
        const resultImg = Utils.$('resultImage');

        const isDirectSource = _resultURL.startsWith('data:') || _resultURL.startsWith('blob:');
        const displayUrl = isDirectSource ? _resultURL : `${_resultURL}?t=${Date.now()}`;

        if (resultImg) {
            resultImg.src = displayUrl;
        }

        const afterImg = Utils.$('comparisonAfter');
        if (afterImg) {
            afterImg.src = displayUrl;
        }

        Utils.show(resultCard);
        Utils.show(Utils.$('downloadSection'));
    }

    /**
     * Show before/after comparison.
     */
    function showComparison() {
        const comparisonView = Utils.$('comparisonView');
        const beforeImg = Utils.$('comparisonBefore');
        const afterImg = Utils.$('comparisonAfter');

        if (beforeImg && _originalURL) beforeImg.src = _originalURL;
        if (afterImg && _resultURL) afterImg.src = `${_resultURL}?t=${Date.now()}`;

        Utils.show(comparisonView);
    }

    /**
     * Hide comparison view.
     */
    function hideComparison() {
        Utils.hide(Utils.$('comparisonView'));
    }

    /**
     * Toggle between side-by-side and overlay comparison.
     */
    function toggleComparisonMode() {
        const container = Utils.$('comparisonContainer');
        if (!container) return;

        _overlayMode = !_overlayMode;
        container.classList.toggle('overlay-mode', _overlayMode);

        const afterSide = container.querySelector('.comparison-side--after');
        if (afterSide) {
            afterSide.style.display = _overlayMode ? 'none' : '';
        }
    }

    /**
     * Get the current result ID.
     */
    function getResultId() {
        return _resultId;
    }

    /**
     * Clear all previews.
     */
    function reset() {
        if (_originalURL) {
            Utils.revokeObjectURL(_originalURL);
            _originalURL = null;
        }
        _resultURL = null;
        _resultId = null;
        _overlayMode = false;

        const originalImg = Utils.$('originalImage');
        const resultImg = Utils.$('resultImage');
        if (originalImg) originalImg.src = '';
        if (resultImg) resultImg.src = '';

        Utils.hide(Utils.$('previewResult'));
        Utils.hide(Utils.$('downloadSection'));
        Utils.hide(Utils.$('comparisonView'));
    }

    return {
        init,
        showOriginal,
        showResult,
        showComparison,
        hideComparison,
        getResultId,
        reset
    };
})();
