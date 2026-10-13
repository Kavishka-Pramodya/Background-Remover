import os
import logging
import threading
from pathlib import Path
from PIL import Image

logger = logging.getLogger(__name__)

# Point U2NET_HOME to bundled models if available for offline, instant zero-download loading
BUNDLED_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
if (BUNDLED_MODELS_DIR / "u2netp.onnx").exists():
    os.environ["U2NET_HOME"] = str(BUNDLED_MODELS_DIR)
    logger.info(f"Using bundled model directory: {BUNDLED_MODELS_DIR}")

# Global session holder
_session = None
_model_available = False
_is_initializing = False
_model_name = os.environ.get("REMBG_MODEL", "u2netp")
_last_error = None

def _load_model_worker():
    global _session, _model_available, _is_initializing, _model_name, _last_error
    try:
        from rembg import new_session
        logger.info(f"Initializing rembg session ({_model_name})...")
        _session = new_session(_model_name)
        _model_available = True
        _last_error = None
        logger.info(f"rembg session ({_model_name}) initialized successfully and ready for inference!")
    except Exception as e:
        logger.warning(f"Could not initialize rembg session with {_model_name}: {e}")
        _last_error = str(e)
        if _model_name != "u2netp":
            try:
                logger.info("Falling back to lightweight u2netp model (4.5MB)...")
                from rembg import new_session
                _model_name = "u2netp"
                _session = new_session("u2netp")
                _model_available = True
                _last_error = None
                logger.info("u2netp fallback session initialized successfully!")
            except Exception as fe:
                logger.error(f"Fallback to u2netp also failed: {fe}")
                _last_error = str(fe)
                _model_available = False
        else:
            _model_available = False
    finally:
        _is_initializing = False

def init_remover():
    """No eager startup thread - model loads on-demand on first user request."""
    pass

def is_model_ready() -> bool:
    return _model_available or (BUNDLED_MODELS_DIR / "u2netp.onnx").exists()

def get_model_info() -> dict:
    has_bundled = (BUNDLED_MODELS_DIR / "u2netp.onnx").exists()
    return {
        "model_loaded": _model_available or has_bundled,
        "model_name": _model_name,
        "is_initializing": False,
        "error": _last_error
    }

def remove_background(image: Image.Image) -> Image.Image:
    """Remove background from image and return transparent RGBA PIL Image."""
    global _session, _model_available, _model_name
    import gc

    # Cap maximum dimension to 1200px during inference to stay well within 512MB RAM limits
    max_dim = max(image.width, image.height)
    orig_size = image.size
    img_to_process = image
    if max_dim > 1200:
        scale_ratio = 1200.0 / max_dim
        new_w = max(1, int(image.width * scale_ratio))
        new_h = max(1, int(image.height * scale_ratio))
        img_to_process = image.resize((new_w, new_h), Image.Resampling.LANCZOS)

    try:
        # If session not yet loaded, load it on demand
        if _session is None:
            from rembg import new_session
            logger.info(f"Loading rembg session on demand ({_model_name})...")
            try:
                _session = new_session(_model_name)
            except Exception:
                _model_name = "u2netp"
                _session = new_session("u2netp")
            _model_available = True

        from rembg import remove
        output = remove(img_to_process, session=_session)

        # If downscaled for inference, upscale back to original resolution
        if orig_size != img_to_process.size:
            output = output.resize(orig_size, Image.Resampling.LANCZOS)

        return output
    except Exception as e:
        logger.error(f"Failed to remove background: {e}")
        raise RuntimeError(f"Background removal service error: {str(e)}")
    finally:
        gc.collect()


