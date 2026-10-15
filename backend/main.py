import os
# Strictly limit CPU thread allocation to prevent ONNX Runtime from spawning 64+ threads on cloud hosts
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.health import router as health_router
from backend.routes.templates import router as templates_router
from backend.routes.process import router as process_router
from backend.routes.results import router as results_router
from backend.utils.temp_manager import cleanup_expired_files
from backend.config import CLEANUP_INTERVAL_MINUTES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("product_studio")

async def background_cleanup_loop():
    """Periodically clean up expired images."""
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL_MINUTES * 60)
            logger.info("Running expired file cleanup...")
            cleanup_expired_files()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ultra-lightweight boot (under 25MB RAM). Model is loaded on-demand during first request.
    logger.info("Product Image Studio backend ready (low-memory mode).")
    cleanup_task = asyncio.create_task(background_cleanup_loop())
    yield
    # Shutdown: Clean up background tasks
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Backend shut down cleanly.")

app = FastAPI(
    title="Product Image Studio API",
    description="High-quality e-commerce product image creation with background removal and studio presets.",
    version="1.0.0",
    lifespan=lifespan
)

# Private Network Access (PNA) header support for Chrome / Edge HTTPS (Vercel) to localhost:8000 communication
class PrivateNetworkAccessMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"access-control-allow-private-network", b"true"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)

# Add PNA middleware outer-most
app.add_middleware(PrivateNetworkAccessMiddleware)

# CORS setup — allow local development frontend and production Vercel apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes with /api prefix
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(templates_router, prefix="/api", tags=["Templates"])
app.include_router(process_router, prefix="/api", tags=["Processing"])
app.include_router(results_router, prefix="/api", tags=["Results"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
