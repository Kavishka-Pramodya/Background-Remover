import io
from pathlib import Path
from PIL import Image

def export_image(image: Image.Image, output_path: Path, format: str = "png"):
    """Save the final composited image in PNG or JPEG format."""
    format_clean = format.lower().strip()
    
    if format_clean in ("jpg", "jpeg"):
        # Convert RGBA to RGB with clean background fill
        rgb_image = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "RGBA":
            rgb_image.paste(image, mask=image.split()[3])
        else:
            rgb_image.paste(image)
        rgb_image.save(output_path, format="JPEG", quality=92, optimize=True)
    else:
        # Default to PNG
        image.save(output_path, format="PNG", optimize=True)

def export_to_bytes(image: Image.Image, format: str = "png") -> bytes:
    """Export image directly to byte buffer."""
    buf = io.BytesIO()
    format_clean = format.lower().strip()
    if format_clean in ("jpg", "jpeg"):
        rgb_image = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "RGBA":
            rgb_image.paste(image, mask=image.split()[3])
        else:
            rgb_image.paste(image)
        rgb_image.save(buf, format="JPEG", quality=92, optimize=True)
    else:
        image.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf.getvalue()
