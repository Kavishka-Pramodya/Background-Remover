/**
 * app.js — Application controller
 * 
 * Manages application lifecycle, screen transitions, and coordinates
 * interactions between modules.
 */
const App = (() => {

    // Application state
    const state = {
        currentScreen: 'upload',  // 'upload' | 'editor'
        currentFile: null,
        currentDimensions: null,
        isProcessing: false,
        hasResult: false,
        backendAvailable: false
    };

    function init() {
        // Initialize modules
        UploadManager.init(onFileAccepted);
        TemplateManager.init(onTemplateSelected);
        ControlsManager.init(onControlsChanged);
        PreviewManager.init();
        EraserManager.init();

        // Wire up buttons
        _bindActions();

        // Check backend health
        _checkBackend();
    }

    function _bindActions() {
        // Process button
        const btnProcess = Utils.$('btnProcess');
        if (btnProcess) {
            btnProcess.addEventListener('click', () => onProcessClick(false));
        }

        // Reset / New Image
        const btnResetImage = Utils.$('btnResetImage');
        if (btnResetImage) {
            btnResetImage.addEventListener('click', onResetClick);
        }

        // Download buttons
        const btnDownloadPNG = Utils.$('btnDownloadPNG');
        const btnDownloadJPEG = Utils.$('btnDownloadJPEG');
        if (btnDownloadPNG) {
            btnDownloadPNG.addEventListener('click', () => onDownload('png'));
        }
        if (btnDownloadJPEG) {
            btnDownloadJPEG.addEventListener('click', () => onDownload('jpeg'));
        }

        // Touch-up / Eraser buttons
        const btnOpenEraser = Utils.$('btnOpenEraser');
        const btnTouchupAction = Utils.$('btnTouchupAction');
        if (btnOpenEraser) {
            btnOpenEraser.addEventListener('click', onOpenEraser);
        }
        if (btnTouchupAction) {
            btnTouchupAction.addEventListener('click', onOpenEraser);
        }

        // Reprocess with current settings
        const btnReprocess = Utils.$('btnReprocess');
        if (btnReprocess) {
            btnReprocess.addEventListener('click', () => onProcessClick(true));
        }

        // Retry processing
        const btnRetryProcess = Utils.$('btnRetryProcess');
        if (btnRetryProcess) {
            btnRetryProcess.addEventListener('click', () => onProcessClick(false));
        }

        // Help modal
        const navHelp = Utils.$('navHelp');
        const helpModal = Utils.$('helpModal');
        const helpClose = Utils.$('helpClose');

        if (navHelp && helpModal) {
            navHelp.addEventListener('click', () => Utils.show(helpModal));
        }
        if (helpClose && helpModal) {
            helpClose.addEventListener('click', () => Utils.hide(helpModal));
        }
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) Utils.hide(helpModal);
            });
        }

        // Keyboard: Escape to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Utils.hide(Utils.$('helpModal'));
            }
        });
    }

    async function _checkBackend() {
        try {
            const health = await ApiService.checkHealth();
            state.backendAvailable = health.status === 'healthy';
            if (state.backendAvailable) {
                console.log('Backend connected:', health);
            }
        } catch (err) {
            state.backendAvailable = false;
            console.warn('Backend not available:', err.message);
        }

        _updateProcessButton();
    }

    function _updateProcessButton() {
        const btnProcess = Utils.$('btnProcess');
        if (!btnProcess) return;
        btnProcess.disabled = false;
    }

    // ===== SCREEN MANAGEMENT =====

    function showScreen(screenName) {
        state.currentScreen = screenName;

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        const targetScreen = Utils.$(`screen${screenName.charAt(0).toUpperCase() + screenName.slice(1)}`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    // ===== EVENT HANDLERS =====

    function onFileAccepted(file, dimensions) {
        state.currentFile = file;
        state.currentDimensions = dimensions;
        state.hasResult = false;

        // Show editor screen
        showScreen('editor');

        // Show original preview
        PreviewManager.showOriginal(file, dimensions);

        // Reset UI states
        Utils.hide(Utils.$('previewResult'));
        Utils.hide(Utils.$('downloadSection'));
        Utils.hide(Utils.$('comparisonView'));
        Utils.hide(Utils.$('processingState'));
        Utils.hide(Utils.$('processingError'));
        Utils.show(Utils.$('btnProcess'));

        const currentTpl = TemplateManager.getSelectedTemplate();
        const tplName = currentTpl ? currentTpl.name : 'Studio';
        const btnProcess = Utils.$('btnProcess');
        if (btnProcess) {
            btnProcess.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5V4.5M9 13.5V16.5M1.5 9H4.5M13.5 9H16.5M3.7 3.7L5.8 5.8M12.2 12.2L14.3 14.3M14.3 3.7L12.2 5.8M5.8 12.2L3.7 14.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Create with ${tplName}
            `;
        }

        Utils.showToast('Image loaded — choose a background and adjust settings', 'success');
    }

    function onTemplateSelected(template, userInitiated = true) {
        // Apply template defaults to controls
        if (template.defaults) {
            ControlsManager.setValues(template.defaults);
        }

        const btnProcess = Utils.$('btnProcess');
        if (btnProcess) {
            btnProcess.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5V4.5M9 13.5V16.5M1.5 9H4.5M13.5 9H16.5M3.7 3.7L5.8 5.8M12.2 12.2L14.3 14.3M14.3 3.7L12.2 5.8M5.8 12.2L3.7 14.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Create with ${template.name}
            `;
        }

        // If the image was ALREADY processed, automatically apply the newly selected background!
        if (userInitiated && state.hasResult && !state.isProcessing) {
            Utils.showToast(`Applying ${template.name}...`, 'info', 1500);
            onProcessClick(true);
        } else if (userInitiated) {
            Utils.showToast(`Selected ${template.name}`, 'info', 1500);
        }
    }

    let _debounceTimer = null;
    function onControlsChanged(values) {
        // If result is already generated, automatically update after user stops sliding (debounced)
        if (state.hasResult && !state.isProcessing) {
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => {
                onProcessClick(true);
            }, 400);
        }
    }

    async function onProcessClick(preferFastReprocess = false) {
        if (state.isProcessing) return;

        if (!state.currentFile) {
            Utils.showToast('Please upload an image first.', 'error');
            return;
        }

        const templateId = TemplateManager.getSelectedId();
        if (!templateId) {
            Utils.showToast('Please select a background template.', 'error');
            return;
        }

        // Check backend availability
        if (!state.backendAvailable) {
            try {
                await _checkBackend();
            } catch { /* ignore */ }

            if (!state.backendAvailable) {
                Utils.showToast('Cannot connect to the server. Please ensure the backend is running.', 'error');
                _showProcessingError('Server not available. Start the backend with: uvicorn backend.main:app --host 127.0.0.1 --port 8000');
                return;
            }
        }

        const resultId = PreviewManager.getResultId();
        const canFastReprocess = preferFastReprocess && state.hasResult && Boolean(resultId);

        state.isProcessing = true;

        const processingMsg = Utils.$('processingMessage');
        const processingSub = Utils.$('processingSubmessage');

        if (!state.hasResult) {
            Utils.hide(Utils.$('btnProcess'));
            Utils.hide(Utils.$('processingError'));
            Utils.hide(Utils.$('previewResult'));
            Utils.hide(Utils.$('downloadSection'));
            Utils.hide(Utils.$('comparisonView'));
            Utils.show(Utils.$('processingState'));
            if (processingMsg) processingMsg.textContent = 'Removing background...';
            if (processingSub) processingSub.textContent = 'Extracting product using AI...';
        } else {
            // Subtle indicator if already showing result
            if (processingMsg) processingMsg.textContent = 'Updating background & shadow...';
            if (processingSub) processingSub.textContent = 'Re-compositing studio image...';
        }

        const settings = {
            template_id: templateId,
            ...ControlsManager.getValues()
        };

        try {
            let result;

            if (canFastReprocess) {
                // Instant re-compositing using pre-extracted cutout (~50ms)
                try {
                    result = await ApiService.reprocessImage(resultId, settings);
                } catch (reErr) {
                    // Fall back to full processing if cache expired
                    console.warn('Fast reprocess failed, falling back to full process:', reErr.message);
                    result = await ApiService.processImage(state.currentFile, settings);
                }
            } else {
                // Full background removal + compositing
                result = await ApiService.processImage(state.currentFile, settings);
            }

            state.isProcessing = false;
            state.hasResult = true;

            Utils.hide(Utils.$('processingState'));
            Utils.show(Utils.$('btnProcess'));

            PreviewManager.showResult(result);

            const selectedTpl = TemplateManager.getSelectedTemplate();
            const name = selectedTpl ? selectedTpl.name : 'Studio';
            Utils.showToast(`Applied ${name}!`, 'success', 2500);

        } catch (err) {
            state.isProcessing = false;
            Utils.hide(Utils.$('processingState'));
            Utils.show(Utils.$('btnProcess'));

            if (err.cancelled) {
                Utils.showToast('Processing was cancelled.', 'info');
                return;
            }

            console.error('Processing error:', err);
            _showProcessingError(err.message || 'An unexpected error occurred during processing.');
            Utils.showToast(err.message || 'Processing failed', 'error');
        }
    }

    function _showProcessingError(message) {
        const errorEl = Utils.$('processingError');
        const errorText = Utils.$('processingErrorText');

        if (errorText) errorText.textContent = message;
        Utils.show(errorEl);
    }

    function onOpenEraser() {
        const resultId = PreviewManager.getResultId();
        if (!resultId || !state.hasResult) {
            Utils.showToast('Please create an image first before touching up.', 'error');
            return;
        }

        EraserManager.open(resultId, onEraserApply);
    }

    async function onEraserApply(cutoutBlob) {
        const resultId = PreviewManager.getResultId();
        if (!resultId) return;

        const templateId = TemplateManager.getSelectedId() || 'premium_light';
        const settings = {
            template_id: templateId,
            ...ControlsManager.getValues()
        };

        state.isProcessing = true;
        const processingMsg = Utils.$('processingMessage');
        const processingSub = Utils.$('processingSubmessage');
        if (processingMsg) processingMsg.textContent = 'Applying eraser touch-up...';
        if (processingSub) processingSub.textContent = 'Re-compositing studio background...';

        Utils.show(Utils.$('processingState'));

        try {
            const result = await ApiService.reprocessImage(resultId, settings, cutoutBlob);
            state.isProcessing = false;
            Utils.hide(Utils.$('processingState'));
            PreviewManager.showResult(result);
            Utils.showToast('Touch-up applied successfully!', 'success');
        } catch (err) {
            state.isProcessing = false;
            Utils.hide(Utils.$('processingState'));
            console.error('Error applying eraser touchup:', err);
            Utils.showToast(err.message || 'Failed to apply touch-up.', 'error');
        }
    }

    function onResetClick() {
        state.currentFile = null;
        state.currentDimensions = null;
        state.hasResult = false;
        state.isProcessing = false;

        PreviewManager.reset();
        ControlsManager.resetToDefaults();
        UploadManager.resetUploadUI();

        showScreen('upload');
    }

    async function onDownload(format) {
        const resultId = PreviewManager.getResultId();
        if (!resultId) {
            Utils.showToast('No processed image to download.', 'error');
            return;
        }

        try {
            await ApiService.downloadResult(resultId, format);
            Utils.showToast(`Downloading ${format.toUpperCase()} image...`, 'success');
        } catch (err) {
            Utils.showToast(`Download failed: ${err.message}`, 'error');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        showScreen,
        getState: () => ({ ...state })
    };
})();
