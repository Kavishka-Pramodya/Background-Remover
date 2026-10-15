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
        // Initialize Core Firebase & Multi-Tenant Services
        if (typeof FirebaseConfig !== 'undefined') FirebaseConfig.init();
        if (typeof AuthManager !== 'undefined') {
            AuthManager.init();
            AuthManager.onAuthStateChanged(_onRoleChanged);
        }
        if (typeof OrderManager !== 'undefined') OrderManager.init();

        // Initialize Store & Studio modules
        if (typeof StoreManager !== 'undefined') StoreManager.init();
        if (typeof AdminManager !== 'undefined') AdminManager.init();
        UploadManager.init(onFileAccepted);
        TemplateManager.init(onTemplateSelected);
        ControlsManager.init(onControlsChanged);
        PreviewManager.init();
        EraserManager.init();

        // Wire up buttons
        _bindActions();

        // Show storefront by default
        showScreen('storefront');

        // Check backend health
        _checkBackend();
    }

    function _onRoleChanged(user) {
        const activeLabel = Utils.$('roleQuickActiveLabel');
        const btnAdmin1 = Utils.$('btnSwitchAdmin1');
        const btnAdmin2 = Utils.$('btnSwitchAdmin2');
        const btnClient = Utils.$('btnSwitchClient');
        const btnGuest = Utils.$('btnSwitchGuest');

        const role = user ? user.role : 'guest';

        // Update Persona Buttons
        [btnAdmin1, btnAdmin2, btnClient, btnGuest].forEach(b => {
            if (b) b.classList.remove('btn-role-switch--active');
        });

        if (role === 'admin1' && btnAdmin1) btnAdmin1.classList.add('btn-role-switch--active');
        if (role === 'admin2' && btnAdmin2) btnAdmin2.classList.add('btn-role-switch--active');
        if (role === 'client' && btnClient) btnClient.classList.add('btn-role-switch--active');
        if (role === 'guest' && btnGuest) btnGuest.classList.add('btn-role-switch--active');

        if (activeLabel) {
            if (role === 'admin1') activeLabel.innerHTML = `Logged in as: <strong>Admin 1 · Super Admin (${user.displayName})</strong>`;
            else if (role === 'admin2') activeLabel.innerHTML = `Logged in as: <strong>Admin 2 · Partner Merchant (${user.displayName})</strong>`;
            else if (role === 'client') activeLabel.innerHTML = `Logged in as: <strong>Customer (${user.displayName})</strong>`;
            else activeLabel.innerHTML = `Browsing as: <strong>Guest Visitor</strong>`;
        }

        // Update Firebase Pill in Admin tab
        const fbPill = Utils.$('firebaseStatusPill');
        if (fbPill) {
            if (typeof FirebaseConfig !== 'undefined' && FirebaseConfig.isLive()) {
                fbPill.className = 'role-pill role-pill--client';
                fbPill.innerHTML = `🔥 Connected to Live Cloud Firestore (${FirebaseConfig.getConfig().projectId})`;
            } else {
                fbPill.className = 'role-pill role-pill--admin1';
                fbPill.innerHTML = `⚡ Local Storage Fallback Active (Zero Cloud Config Required)`;
            }
        }
    }

    function _bindActions() {
        // Screen mode switching: Storefront vs Store Owner Admin
        const navStorefront = Utils.$('navStorefront');
        const navAdminPortal = Utils.$('navAdminPortal');
        const btnGoToAdmin = Utils.$('btnGoToAdmin');
        const btnBackToStore = Utils.$('btnBackToStore');

        if (navStorefront) navStorefront.addEventListener('click', () => showScreen('storefront'));
        if (navAdminPortal) navAdminPortal.addEventListener('click', () => showScreen('admin'));
        if (btnGoToAdmin) btnGoToAdmin.addEventListener('click', () => showScreen('admin'));
        if (btnBackToStore) btnBackToStore.addEventListener('click', () => showScreen('storefront'));
        const brandLogo = Utils.$('brandLogo');
        if (brandLogo) brandLogo.addEventListener('click', () => showScreen('storefront'));

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

        // Local engine modal bindings
        const localEngineModal = Utils.$('localEngineModal');
        const localEngineModalClose = Utils.$('localEngineModalClose');
        const btnModalTryDemoMode = Utils.$('btnModalTryDemoMode');

        if (localEngineModalClose && localEngineModal) {
            localEngineModalClose.addEventListener('click', () => Utils.hide(localEngineModal));
        }
        if (localEngineModal) {
            localEngineModal.addEventListener('click', (e) => {
                if (e.target === localEngineModal) Utils.hide(localEngineModal);
            });
        }
        if (btnModalTryDemoMode) {
            btnModalTryDemoMode.addEventListener('click', () => {
                if (localEngineModal) Utils.hide(localEngineModal);
                onProcessClick(false, true);
            });
        }

        // Keyboard: Escape to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Utils.hide(Utils.$('helpModal'));
                Utils.hide(Utils.$('localEngineModal'));
            }
        });
    }

    async function _checkBackend() {
        if (typeof AdminManager !== 'undefined' && AdminManager.isLocalEngineActive()) {
            state.backendAvailable = true;
            _updateProcessButton();
            return true;
        }

        try {
            const health = await ApiService.checkHealth();
            state.backendAvailable = health.status === 'healthy';
            if (state.backendAvailable) {
                console.log('Backend connected:', health);
            }
        } catch (err) {
            state.backendAvailable = (typeof AdminManager !== 'undefined' && AdminManager.isLocalEngineActive());
            console.warn('Backend not available:', err.message);
        }

        _updateProcessButton();
        return state.backendAvailable;
    }

    function _updateProcessButton() {
        const btnProcess = Utils.$('btnProcess');
        if (!btnProcess) return;
        btnProcess.disabled = false;
    }

    // ===== SCREEN MANAGEMENT =====

    function showScreen(screenName) {
        state.currentScreen = screenName;

        const screenStorefront = Utils.$('screenStorefront');
        const screenAdmin = Utils.$('screenAdmin');
        const screenUpload = Utils.$('screenUpload');
        const screenEditor = Utils.$('screenEditor');
        const navStorefront = Utils.$('navStorefront');
        const navAdminPortal = Utils.$('navAdminPortal');

        if (screenName === 'storefront') {
            if (screenStorefront) screenStorefront.classList.add('active');
            if (screenAdmin) screenAdmin.classList.remove('active');
            if (navStorefront) navStorefront.classList.add('active');
            if (navAdminPortal) navAdminPortal.classList.remove('active');
            if (typeof StoreManager !== 'undefined') StoreManager.renderProducts();
        } else if (screenName === 'admin' || screenName === 'upload') {
            if (typeof AuthManager !== 'undefined' && !AuthManager.isAdmin()) {
                Utils.showToast('Please sign in as Admin 1 or Admin 2 to access Merchant Studio.', 'warning');
                const authModal = Utils.$('authModal');
                if (authModal) Utils.show(authModal);
                return;
            }
            if (screenStorefront) screenStorefront.classList.remove('active');
            if (screenAdmin) screenAdmin.classList.add('active');
            if (screenUpload) Utils.show(screenUpload);
            if (screenEditor) Utils.hide(screenEditor);
            if (navStorefront) navStorefront.classList.remove('active');
            if (navAdminPortal) navAdminPortal.classList.add('active');
            if (typeof AdminManager !== 'undefined') AdminManager.renderCatalogTable();
        } else if (screenName === 'editor') {
            if (screenStorefront) screenStorefront.classList.remove('active');
            if (screenAdmin) screenAdmin.classList.add('active');
            if (screenUpload) Utils.hide(screenUpload);
            if (screenEditor) Utils.show(screenEditor);
            if (navStorefront) navStorefront.classList.remove('active');
            if (navAdminPortal) navAdminPortal.classList.add('active');
        }
    }

    // ===== EVENT HANDLERS =====

    function onFileAccepted(file, dimensions) {
        state.currentFile = file;
        state.currentDimensions = dimensions;
        state.currentOriginalUrl = URL.createObjectURL(file);
        state.hasResult = false;

        if (typeof AdminManager !== 'undefined') {
            AdminManager.setProcessedImage(state.currentOriginalUrl, state.currentOriginalUrl);
        }

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

    async function onProcessClick(preferFastReprocess = false, forceDemo = false) {
        if (state.isProcessing) return;

        if (!state.currentFile) {
            Utils.showToast('Please upload an image first.', 'error');
            return;
        }

        const templateId = TemplateManager.getSelectedId() || 'premium_light';

        // Check backend availability unless forceDemo is explicitly selected
        if (!forceDemo) {
            await _checkBackend();

            if (!state.backendAvailable) {
                const localModal = Utils.$('localEngineModal');
                if (localModal) {
                    Utils.show(localModal);
                    return;
                }
            }
        }

        const localModal = Utils.$('localEngineModal');
        if (localModal) Utils.hide(localModal);

        const resultId = PreviewManager.getResultId();
        const canFastReprocess = preferFastReprocess && state.hasResult && Boolean(resultId) && !resultId.startsWith('demo_');

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
            if (processingMsg) processingMsg.textContent = forceDemo ? 'Creating Studio Card...' : 'Removing background...';
            if (processingSub) processingSub.textContent = forceDemo ? 'Compositing lighting & shadows...' : 'Extracting product using AI...';
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

            if (forceDemo || (!state.backendAvailable && !canFastReprocess)) {
                // Client-side instant canvas compositor
                result = await _generateClientSideDemoPreview(state.currentFile, settings);
            } else if (canFastReprocess) {
                // Instant re-compositing using pre-extracted cutout (~50ms)
                try {
                    result = await ApiService.reprocessImage(resultId, settings);
                } catch (reErr) {
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
            if (typeof AdminManager !== 'undefined') {
                const previewUrl = result.preview_url || ApiService.getPreviewURL(result.result_id);
                AdminManager.setProcessedImage(previewUrl, state.currentOriginalUrl);
            }

            const selectedTpl = TemplateManager.getSelectedTemplate();
            const name = selectedTpl ? selectedTpl.name : 'Studio';
            if (result.is_demo) {
                Utils.showToast(`Preview created with ${name}! (Run Local AI engine for precision edge cutout)`, 'info', 4000);
            } else {
                Utils.showToast(`Applied ${name}!`, 'success', 2500);
            }

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

    async function _generateClientSideDemoPreview(file, settings) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 1200;
                canvas.height = 1200;
                const ctx = canvas.getContext('2d');

                // 1. Fill background based on template
                const tplId = settings.template_id || 'premium_light';
                let grad = ctx.createLinearGradient(0, 0, 0, 1200);
                if (tplId === 'warm_neutral') {
                    grad.addColorStop(0, '#fbf8f3');
                    grad.addColorStop(1, '#eee7dd');
                } else if (tplId === 'soft_gray') {
                    grad.addColorStop(0, '#f3f4f6');
                    grad.addColorStop(1, '#e5e7eb');
                } else if (tplId === 'studio_dark') {
                    grad.addColorStop(0, '#2d3748');
                    grad.addColorStop(1, '#1a202c');
                } else {
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(1, '#f1f5f9');
                }
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 1200, 1200);

                // 2. Floor shadow oval
                const shadowIntensity = (settings.shadow_intensity != null ? settings.shadow_intensity : 40) / 100;
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(600, 960, 320, 50, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 0, 0, ${shadowIntensity * 0.25})`;
                ctx.filter = `blur(${settings.shadow_softness || 30}px)`;
                ctx.fill();
                ctx.restore();

                // 3. Draw scaled product image
                const scale = (settings.scale != null ? settings.scale : 80) / 100;
                const aspect = img.width / img.height;
                let drawW = 900 * scale;
                let drawH = drawW / aspect;
                if (drawH > 900 * scale) {
                    drawH = 900 * scale;
                    drawW = drawH * aspect;
                }
                const drawX = 600 - drawW / 2;
                const posYFactor = (settings.position_y != null ? settings.position_y : 50) / 100;
                const drawY = (1200 - drawH) * posYFactor;

                ctx.drawImage(img, drawX, drawY, drawW, drawH);

                const dataUrl = canvas.toDataURL('image/png');
                resolve({
                    result_id: 'demo_' + Date.now(),
                    preview_url: dataUrl,
                    is_demo: true,
                    processing_time: 0.1
                });
            };
            img.onerror = () => reject(new Error('Failed to load image for preview.'));
            img.src = URL.createObjectURL(file);
        });
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
            if (typeof AdminManager !== 'undefined') {
                const previewUrl = ApiService.getPreviewURL(result.result_id);
                AdminManager.setProcessedImage(previewUrl, state.currentOriginalUrl);
            }
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
