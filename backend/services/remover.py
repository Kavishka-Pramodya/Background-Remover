import logging
import threading
from PIL import Image

logger = logging.getLogger(__name__)

# Global session holder
_session = None
_model_available = False
_is_initializing = False

def _load_model_worker():
    global _session, _model_available, _is_initializing
    try:
        from rembg import new_session
        logger.info("Initializing rembg session (u2net)...")
        _session = new_session("u2net")
        _model_available = True
        logger.info("rembg session initialized successfully and ready for inference!")
    except Exception as e:
        logger.warning(f"Could not initialize rembg session: {e}")
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

def remove_background(image: Image.Image) -> Image.Image:
    """Remove background from image and return transparent RGBA PIL Image."""
    global _session, _model_available

    # If already loaded, use session
    if _session is not None:
        try:
            from rembg import remove
            output = remove(image, session=_session)
            return output
        except Exception as e:
            logger.error(f"rembg removal failed: {e}")
            raise RuntimeError(f"Background removal failed: {str(e)}")

    # Otherwise load synchronously on demand
    try:
        from rembg import remove, new_session
        logger.info("Loading rembg session on demand...")
        _session = new_session("u2net")
        _model_available = True
        output = remove(image, session=_session)
        return output
    except Exception as e:
        logger.error(f"Failed to remove background: {e}")
        raise RuntimeError(f"Background removal service error: {str(e)}")
