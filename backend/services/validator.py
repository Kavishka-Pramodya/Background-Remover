import io
from PIL import Image, ImageOps
from fastapi import HTTPException, UploadFile
from backend.config import (
    MAX_UPLOAD_SIZE_BYTES,
    MAX_IMAGE_PIXELS,
    MAX_DIMENSION,
    ALLOWED_FORMATS,
    ALLOWED_EXTENSIONS
)

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

def validate_magic_bytes(content: bytes) -> str:
    """Validate image format by magic bytes."""
    if len(content) < 12:
        raise HTTPException(status_code=400, detail="File too small or corrupted.")

    if content.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    elif content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "WEBP"
    
    raise HTTPException(
        status_code=400,
        detail="Unsupported image format. Allowed formats: JPEG, PNG, WebP."
    )

def validate_and_load_image(content: bytes, filename: str) -> Image.Image:
    """Validate file content, size, dimensions, and normalize orientation."""
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size limit of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
        )

    # Magic byte check
    detected_format = validate_magic_bytes(content)

    try:
        image = Image.open(io.BytesIO(content))
        image.verify()  # Check for corruption
    except Exception:
        raise HTTPException(status_code=400, detail="Corrupted or invalid image file.")

    # Re-open after verify() closes the stream
    try:
        image = Image.open(io.BytesIO(content))
        
        # Protect against decompression bombs
        w, h = image.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION or (w * h) > MAX_IMAGE_PIXELS:
            raise HTTPException(
                status_code=400,
                detail=f"Image dimensions ({w}x{h}) exceed maximum allowed limit."
            )

        # Apply EXIF rotation if present
        image = ImageOps.exif_transpose(image)

        # Ensure in RGB or RGBA mode
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")

        return image
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")
