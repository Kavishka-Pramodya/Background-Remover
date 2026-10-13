import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from backend.config import RESULTS_DIR

router = APIRouter()

@router.get("/results/{result_id}/preview")
async def get_result_preview(result_id: str):
    result_dir = RESULTS_DIR / result_id
    if not result_dir.exists():
        raise HTTPException(status_code=404, detail="Result not found or expired.")

    # Find the output image file
    for ext in ["png", "jpeg", "jpg"]:
        candidate = result_dir / f"output.{ext}"
        if candidate.exists():
            media = "image/png" if ext == "png" else "image/jpeg"
            return FileResponse(candidate, media_type=media)

    raise HTTPException(status_code=404, detail="Output file not found.")

@router.get("/results/{result_id}/cutout")
async def get_result_cutout(result_id: str):
    """Return the raw transparent product cutout for eraser/touch-up editing."""
    result_dir = RESULTS_DIR / result_id
    if not result_dir.exists():
        raise HTTPException(status_code=404, detail="Result not found or expired.")

    cutout_path = result_dir / "cutout.png"
    if not cutout_path.exists():
        raise HTTPException(status_code=404, detail="Cutout file not found.")

    return FileResponse(cutout_path, media_type="image/png")

@router.get("/results/{result_id}/download")
async def download_result(result_id: str, format: str = "png"):
    result_dir = RESULTS_DIR / result_id
    if not result_dir.exists():
        raise HTTPException(status_code=404, detail="Result not found or expired.")

    format_clean = "jpeg" if format.lower() in ("jpg", "jpeg") else "png"
    file_path = result_dir / f"output.{format_clean}"

    if not file_path.exists():
        # Fall back to whatever is generated
        candidate_png = result_dir / "output.png"
        if candidate_png.exists():
            file_path = candidate_png
            format_clean = "png"
        else:
            raise HTTPException(status_code=404, detail="Processed file not found.")

    safe_filename = f"product_studio_{result_id}.{format_clean}"
    return FileResponse(
        file_path,
        media_type="image/png" if format_clean == "png" else "image/jpeg",
        filename=safe_filename
    )

@router.get("/results/{result_id}")
async def get_result_metadata(result_id: str):
    meta_file = RESULTS_DIR / result_id / "metadata.json"
    if not meta_file.exists():
        raise HTTPException(status_code=404, detail="Result metadata not found.")
    
    with open(meta_file, "r") as f:
        data = json.load(f)
    return data
