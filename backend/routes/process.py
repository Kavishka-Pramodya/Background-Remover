import json
import asyncio
from datetime import datetime
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from backend.config import RESULTS_DIR, CANVAS_SIZE, MAX_CONCURRENT_PROCESSING
from backend.utils.identifiers import generate_id
from backend.utils.temp_manager import safe_delete
from backend.services.validator import validate_and_load_image
from backend.services.remover import remove_background
from backend.services.compositor import composite_product_image
from backend.services.exporter import export_image
from backend.services.templates import TEMPLATES

router = APIRouter()
processing_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PROCESSING)

@router.post("/process")
async def process_image(
    image: UploadFile = File(...),
    template_id: str = Form("premium_light"),
    scale: int = Form(80),
    position_x: int = Form(50),
    position_y: int = Form(50),
    shadow_intensity: int = Form(40),
    shadow_softness: int = Form(30),
    output_format: str = Form("png")
):
    # Validate parameter ranges
    scale = max(10, min(200, scale))
    position_x = max(0, min(100, position_x))
    position_y = max(0, min(100, position_y))
    shadow_intensity = max(0, min(100, shadow_intensity))
    shadow_softness = max(0, min(100, shadow_softness))

    if template_id not in TEMPLATES:
        template_id = "premium_light"

    result_id = generate_id()
    result_dir = RESULTS_DIR / result_id
    result_dir.mkdir(parents=True, exist_ok=True)

    # Acquire concurrency semaphore
    async with processing_semaphore:
        try:
            # 1. Read & validate uploaded image
            content = await image.read()
            validated_img = validate_and_load_image(content, image.filename or "upload.jpg")
            orig_w, orig_h = validated_img.size

            # 2. Run background removal (execute in thread pool to prevent blocking)
            cutout_rgba = await asyncio.to_thread(remove_background, validated_img)

            # 3. Save the transparent cutout for instant re-compositing
            cutout_path = result_dir / "cutout.png"
            await asyncio.to_thread(cutout_rgba.save, cutout_path, "PNG")

            # 4. Composite product onto selected template
            composited = await asyncio.to_thread(
                composite_product_image,
                cutout_rgba=cutout_rgba,
                template_id=template_id,
                scale_pct=scale,
                pos_x_pct=position_x,
                pos_y_pct=position_y,
                shadow_intensity=shadow_intensity,
                shadow_softness=shadow_softness
            )

            # 5. Save both PNG and JPEG versions for instant downloads
            png_path = result_dir / "output.png"
            jpeg_path = result_dir / "output.jpeg"

            await asyncio.to_thread(export_image, composited, png_path, "png")
            await asyncio.to_thread(export_image, composited, jpeg_path, "jpeg")

            # 6. Save metadata
            metadata = {
                "result_id": result_id,
                "status": "completed",
                "preview_url": f"/api/results/{result_id}/preview",
                "download_url": f"/api/results/{result_id}/download",
                "original_filename": image.filename,
                "original_dimensions": [orig_w, orig_h],
                "output_dimensions": [CANVAS_SIZE, CANVAS_SIZE],
                "template_id": template_id,
                "output_format": output_format.lower(),
                "created_at": datetime.utcnow().isoformat() + "Z"
            }

            meta_path = result_dir / "metadata.json"
            with open(meta_path, "w") as f:
                json.dump(metadata, f, indent=2)

            return metadata

        except HTTPException:
            safe_delete(result_dir)
            raise
        except Exception as e:
            safe_delete(result_dir)
            raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

@router.post("/reprocess")
async def reprocess_image(
    result_id: str = Form(...),
    template_id: str = Form("premium_light"),
    scale: int = Form(80),
    position_x: int = Form(50),
    position_y: int = Form(50),
    shadow_intensity: int = Form(40),
    shadow_softness: int = Form(30),
    output_format: str = Form("png")
):
    """
    Ultra-fast re-compositing using the pre-extracted transparent cutout.
    Takes ~50ms instead of re-running AI background removal!
    """
    result_dir = RESULTS_DIR / result_id
    cutout_path = result_dir / "cutout.png"

    if not result_dir.exists() or not cutout_path.exists():
        raise HTTPException(status_code=404, detail="Previous cutout not found. Please upload again.")

    if template_id not in TEMPLATES:
        template_id = "premium_light"

    scale = max(10, min(200, scale))
    position_x = max(0, min(100, position_x))
    position_y = max(0, min(100, position_y))
    shadow_intensity = max(0, min(100, shadow_intensity))
    shadow_softness = max(0, min(100, shadow_softness))

    try:
        # Load pre-extracted cutout directly (instant)
        cutout_rgba = await asyncio.to_thread(Image.open, cutout_path)

        # Composite onto new template with new adjustments
        composited = await asyncio.to_thread(
            composite_product_image,
            cutout_rgba=cutout_rgba,
            template_id=template_id,
            scale_pct=scale,
            pos_x_pct=position_x,
            pos_y_pct=position_y,
            shadow_intensity=shadow_intensity,
            shadow_softness=shadow_softness
        )

        png_path = result_dir / "output.png"
        jpeg_path = result_dir / "output.jpeg"

        await asyncio.to_thread(export_image, composited, png_path, "png")
        await asyncio.to_thread(export_image, composited, jpeg_path, "jpeg")

        # Update metadata
        meta_path = result_dir / "metadata.json"
        metadata = {}
        if meta_path.exists():
            with open(meta_path, "r") as f:
                metadata = json.load(f)

        metadata["template_id"] = template_id
        metadata["output_format"] = output_format.lower()
        metadata["updated_at"] = datetime.utcnow().isoformat() + "Z"

        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        return metadata

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-composition failed: {str(e)}")
