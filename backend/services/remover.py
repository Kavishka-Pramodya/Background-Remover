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
    """Start loading the rembg session in a background daemon thread."""
    global _is_initializing
    if not _is_initializing and not _model_available:
        _is_initializing = True
        thread = threading.Thread(target=_load_model_worker, daemon=True)
        thread.start()

def is_model_ready() -> bool:
    return _model_available

def get_model_info() -> dict:
    return {
        "model_loaded": _model_available,
        "model_name": _model_name if _model_available else None,
        "is_initializing": _is_initializing,
        "error": _last_error
    }

def remove_background(image: Image.Image) -> Image.Image:
    """Remove background from image and return transparent RGBA PIL Image."""
    global _session, _model_available, _model_name

    # If already loaded, use session
    if _session is not None:
        try:
            from rembg import remove
            output = remove(image, session=_session)
            return output
        except Exception as e:
            logger.error(f"rembg removal failed with session: {e}")
            raise RuntimeError(f"Background removal failed: {str(e)}")

    # Otherwise load synchronously on demand
    try:
        from rembg import remove, new_session
        logger.info(f"Loading rembg session on demand ({_model_name})...")
        try:
            _session = new_session(_model_name)
        except Exception:
            _model_name = "u2netp"
            _session = new_session("u2netp")

        _model_available = True
        output = remove(image, session=_session)
        return output
    except Exception as e:
        logger.error(f"Failed to remove background: {e}")
        raise RuntimeError(f"Background removal service error: {str(e)}")

