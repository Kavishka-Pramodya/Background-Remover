import time
import shutil
from pathlib import Path
from backend.config import UPLOADS_DIR, RESULTS_DIR, RESULT_TTL_MINUTES

def cleanup_expired_files():
    """Remove expired results and old temporary uploads."""
    now = time.time()
    cutoff_time = now - (RESULT_TTL_MINUTES * 60)
    upload_cutoff = now - 1800  # 30 minutes for raw uploads

    # Cleanup results
    if RESULTS_DIR.exists():
        for item in RESULTS_DIR.iterdir():
            try:
                if item.is_dir() and item.stat().st_mtime < cutoff_time:
                    shutil.rmtree(item, ignore_errors=True)
            except Exception:
                pass

    # Cleanup orphaned uploads
    if UPLOADS_DIR.exists():
        for item in UPLOADS_DIR.iterdir():
            try:
                if item.is_file() and item.stat().st_mtime < upload_cutoff:
                    item.unlink(missing_ok=True)
            except Exception:
                pass

def safe_delete(path: Path):
    """Safely delete a file or directory without raising errors."""
    try:
        if path.is_file():
            path.unlink(missing_ok=True)
        elif path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass
