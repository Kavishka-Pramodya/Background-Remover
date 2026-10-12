import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
DATA_DIR = BACKEND_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
RESULTS_DIR = DATA_DIR / "results"
TEMPLATES_DIR = DATA_DIR / "templates"

# Ensure directories exist
for path in [DATA_DIR, UPLOADS_DIR, RESULTS_DIR, TEMPLATES_DIR]:
    path.mkdir(parents=True, exist_ok=True)

# Settings
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000  # 40 Megapixels
MAX_DIMENSION = 8192

CANVAS_SIZE = int(os.getenv("CANVAS_SIZE", "1200"))
RESULT_TTL_MINUTES = int(os.getenv("RESULT_TTL_MINUTES", "60"))
CLEANUP_INTERVAL_MINUTES = int(os.getenv("CLEANUP_INTERVAL_MINUTES", "10"))
MAX_CONCURRENT_PROCESSING = int(os.getenv("MAX_CONCURRENT_PROCESSING", "2"))

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
