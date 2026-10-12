from fastapi import APIRouter
from backend.services.remover import is_model_ready

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": is_model_ready(),
        "version": "1.0.0"
    }
