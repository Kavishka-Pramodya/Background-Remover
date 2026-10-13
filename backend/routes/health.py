from fastapi import APIRouter
from backend.services.remover import is_model_ready, get_model_info

router = APIRouter()

@router.get("/health")
async def health_check():
    info = get_model_info()
    return {
        "status": "healthy",
        "version": "1.0.0",
        **info
    }

