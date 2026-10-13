/**
 * eraser.js — Touch-up & Manual Eraser Tool
 * 
 * Interactive 60fps canvas-based brush tool that allows erasing leftover
 * background artifacts or restoring cutout pixels with Undo/Redo support.
 */
const EraserManager = (() => {

    let _modal = null;
    let _canvas = null;
    let _ctx = null;
    let _viewport = null;

    let _originalImage = null; // Unmodified original cutout image
    let _history = [];         // Array of ImageData snapshots for Undo
    const MAX_HISTORY = 25;

    let _isDrawing = false;
    let _toolMode = 'erase';   // 'erase' | 'restore'
    let _brushSize = 25;
    let _lastX = 0;
    let _lastY = 0;
    let _resultId = null;
    let _onApplyCallback = null;

    function init() {
        _modal = Utils.$('eraserModal');
        _canvas = Utils.$('eraserCanvas');
        _viewport = Utils.$('eraserViewport');
        if (!_canvas) return;

        _ctx = _canvas.getContext('2d');

        // Toolbar buttons
        const btnUndo = Utils.$('btnEraserUndo');
        const btnReset = Utils.$('btnEraserReset');
        const btnCancel = Utils.$('btnEraserCancel');
        const btnApply = Utils.$('btnEraserApply');

        if (btnUndo) btnUndo.addEventListener('click', undo);
        if (btnReset) btnReset.addEventListener('click', reset);
        if (btnCancel) btnCancel.addEventListener('click', close);
        if (btnApply) btnApply.addEventListener('click', apply);

        // Tool Mode buttons
        const toolModeErase = Utils.$('toolModeErase');
        const toolModeRestore = Utils.$('toolModeRestore');

        if (toolModeErase) {
            toolModeErase.addEventListener('click', () => setMode('erase'));
        }
        if (toolModeRestore) {
            toolModeRestore.addEventListener('click', () => setMode('restore'));
        }

        // Brush Size Slider
        const brushSlider = Utils.$('eraserBrushSize');
        const brushSizeVal = Utils.$('eraserBrushSizeVal');
        const brushPreviewCircle = Utils.$('brushPreviewCircle');

        if (brushSlider) {
            brushSlider.addEventListener('input', () => {
                _brushSize = parseInt(brushSlider.value, 10);
                if (brushSizeVal) brushSizeVal.textContent = `${_brushSize}px`;
                if (brushPreviewCircle) {
                    brushPreviewCircle.style.width = `${Math.min(50, _brushSize)}px`;
                    brushPreviewCircle.style.height = `${Math.min(50, _brushSize)}px`;
                }
            });
        }

        // Canvas Drawing Events (supports mouse and touch smoothly via PointerEvents)
        _canvas.addEventListener('pointerdown', _onPointerDown);
        window.addEventListener('pointermove', _onPointerMove);
        window.addEventListener('pointerup', _onPointerUp);
        window.addEventListener('pointercancel', _onPointerUp);

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _modal && !_modal.classList.contains('hidden')) {
                close();
            }
        });
    }

    /**
     * Open the Eraser tool with the current result's transparent cutout.
     */
    async function open(resultId, onApplyCallback) {
        if (!resultId) {
            Utils.showToast('Please process an image first before touching up.', 'error');
            return;
        }

        _resultId = resultId;
        _onApplyCallback = onApplyCallback;
        _history = [];

        Utils.show(_modal);
        Utils.showToast('Loading product cutout for editing...', 'info', 1500);

        try {
            // Load transparent cutout image
            const cutoutUrl = ApiService.getCutoutURL(resultId) + `?t=${Date.now()}`;
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Failed to load cutout image'));
                img.src = cutoutUrl;
            });

            _originalImage = img;

            // Set canvas natural dimensions
            _canvas.width = img.naturalWidth || img.width;
            _canvas.height = img.naturalHeight || img.height;

            // Draw initial cutout
            _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
            _ctx.drawImage(img, 0, 0);

            // Save initial snapshot for undo
            _saveSnapshot();

            setMode('erase');

        } catch (err) {
            console.error('Eraser tool load error:', err);
            Utils.showToast('Could not load cutout for touch up.', 'error');
            close();
        }
    }

    function setMode(mode) {
        _toolMode = mode;
        const toolErase = Utils.$('toolModeErase');
        const toolRestore = Utils.$('toolModeRestore');

        if (toolErase) toolErase.classList.toggle('active', mode === 'erase');
        if (toolRestore) toolRestore.classList.toggle('active', mode === 'restore');
    }

    function _saveSnapshot() {
        if (_history.length >= MAX_HISTORY) {
            _history.shift(); // discard oldest
        }
        _history.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    }

    function undo() {
        if (_history.length > 1) {
            _history.pop(); // remove current state
            const previousState = _history[_history.length - 1];
            _ctx.putImageData(previousState, 0, 0);
            Utils.showToast('Undone brush stroke', 'info', 1000);
        } else {
            Utils.showToast('Nothing more to undo', 'info', 1000);
        }
    }

    function reset() {
        if (!_originalImage) return;
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        _ctx.drawImage(_originalImage, 0, 0);
        _saveSnapshot();
        Utils.showToast('Reset to original cutout', 'info', 1500);
    }

    function _getCanvasCoordinates(e) {
        const rect = _canvas.getBoundingClientRect();
        const scaleX = _canvas.width / rect.width;
        const scaleY = _canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function _onPointerDown(e) {
        if (e.button !== 0) return; // Left click only
        _isDrawing = true;
        _canvas.setPointerCapture(e.pointerId);

        const coords = _getCanvasCoordinates(e);
        _lastX = coords.x;
        _lastY = coords.y;

        _drawStroke(coords.x, coords.y, true);
    }

    function _onPointerMove(e) {
        if (!_isDrawing) return;
        const coords = _getCanvasCoordinates(e);
        _drawStroke(coords.x, coords.y, false);
        _lastX = coords.x;
        _lastY = coords.y;
    }

    function _onPointerUp(e) {
        if (!_isDrawing) return;
        _isDrawing = false;
        try {
            _canvas.releasePointerCapture(e.pointerId);
        } catch { /* ignore */ }

        // Save state to undo history
        _saveSnapshot();
    }

    function _drawStroke(currentX, currentY, isInitialDot) {
        _ctx.save();

        if (_toolMode === 'erase') {
            // True eraser: clears pixels by reducing alpha
            _ctx.globalCompositeOperation = 'destination-out';
            _ctx.fillStyle = 'rgba(0,0,0,1)';
            _ctx.strokeStyle = 'rgba(0,0,0,1)';
            _ctx.lineWidth = _brushSize;
            _ctx.lineCap = 'round';
            _ctx.lineJoin = 'round';

            _ctx.beginPath();
            if (isInitialDot) {
                _ctx.arc(currentX, currentY, _brushSize / 2, 0, Math.PI * 2);
                _ctx.fill();
            } else {
                _ctx.moveTo(_lastX, _lastY);
                _ctx.lineTo(currentX, currentY);
                _ctx.stroke();
            }
        } else if (_toolMode === 'restore' && _originalImage) {
            // Restore tool: paints back the original product pixels inside the brush radius
            _ctx.save();
            _ctx.beginPath();
            if (isInitialDot) {
                _ctx.arc(currentX, currentY, _brushSize / 2, 0, Math.PI * 2);
            } else {
                _ctx.lineWidth = _brushSize;
                _ctx.lineCap = 'round';
                _ctx.moveTo(_lastX, _lastY);
                _ctx.lineTo(currentX, currentY);
            }
            _ctx.clip();
            // Draw original cutout pixels into the clipped brush region
            _ctx.drawImage(_originalImage, 0, 0);
            _ctx.restore();
        }

        _ctx.restore();
    }

    async function apply() {
        if (!_canvas) return;

        Utils.showToast('Applying touch-up changes...', 'info', 2000);

        _canvas.toBlob(async (blob) => {
            if (!blob) {
                Utils.showToast('Could not export edited cutout.', 'error');
                return;
            }

            close();

            if (_onApplyCallback) {
                await _onApplyCallback(blob);
            }
        }, 'image/png');
    }

    function close() {
        Utils.hide(_modal);
        _isDrawing = false;
        _history = [];
    }

    return {
        init,
        open,
        close,
        undo,
        reset
    };
})();
