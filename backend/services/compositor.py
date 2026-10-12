from PIL import Image
from backend.services.templates import get_template
from backend.services.shadow import create_realistic_shadow
from backend.config import CANVAS_SIZE

def composite_product_image(
    cutout_rgba: Image.Image,
    template_id: str,
    scale_pct: int = 80,
    pos_x_pct: int = 50,
    pos_y_pct: int = 50,
    shadow_intensity: int = 40,
    shadow_softness: int = 30
) -> Image.Image:
    """
    Full deterministic composition pipeline:
    1. Crop excess transparent borders.
    2. Proportional resize using LANCZOS based on scale.
    3. Calculate placement within canvas_size x canvas_size.
    4. Render chosen background template.
    5. Generate and composite realistic shadow.
    6. Paste foreground product.
    """
    canvas_w = CANVAS_SIZE
    canvas_h = CANVAS_SIZE

    # 1. Trim transparent borders
    bbox = cutout_rgba.getbbox()
    if bbox:
        trimmed = cutout_rgba.crop(bbox)
    else:
        trimmed = cutout_rgba

    tw, th = trimmed.size
    if tw <= 0 or th <= 0:
        raise ValueError("Invalid trimmed image dimensions.")

    # 2. Compute proportional target size
    # Base allocation is approx 75% of canvas at 80% scale
    scale_factor = (scale_pct / 80.0) * 0.72
    max_target_w = canvas_w * scale_factor
    max_target_h = canvas_h * scale_factor

    aspect_ratio = tw / float(th)
    if (max_target_w / aspect_ratio) <= max_target_h:
        new_w = int(max_target_w)
        new_h = int(max_target_w / aspect_ratio)
    else:
        new_h = int(max_target_h)
        new_w = int(max_target_h * aspect_ratio)

    new_w = max(10, min(canvas_w, new_w))
    new_h = max(10, min(canvas_h, new_h))

    resized_fg = trimmed.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)

    # 3. Compute coordinates based on pos_x_pct and pos_y_pct (0 to 100)
    # 50% = perfectly centered
    center_x = int((pos_x_pct / 100.0) * canvas_w)
    center_y = int((pos_y_pct / 100.0) * canvas_h)

    fg_x = center_x - (new_w // 2)
    fg_y = center_y - (new_h // 2)

    # 4. Render selected background template
    template_data = get_template(template_id)
    background_img = template_data["renderer"](canvas_w, canvas_h).convert("RGBA")

    # 5. Generate shadow
    shadow_layer = create_realistic_shadow(
        resized_fg,
        canvas_w,
        (fg_x, fg_y),
        intensity=shadow_intensity,
        softness=shadow_softness
    )

    # Composite shadow onto background
    background_img = Image.alpha_composite(background_img, shadow_layer)

    # 6. Composite product on top
    # Create an RGBA layer for product to handle out-of-canvas bounds cleanly
    fg_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    fg_layer.paste(resized_fg, (fg_x, fg_y), resized_fg)

    final_image = Image.alpha_composite(background_img, fg_layer)

    return final_image
