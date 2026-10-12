import math
from PIL import Image, ImageFilter, ImageOps

def create_realistic_shadow(
    foreground_rgba: Image.Image,
    canvas_size: int,
    fg_pos: tuple[int, int],
    intensity: int = 40,
    softness: int = 30
) -> Image.Image:
    """
    Generate a natural contact & drop shadow layer for the product cutout.
    - intensity: 0 to 100
    - softness: 0 to 100
    """
    if intensity <= 0:
        return Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    fg_w, fg_h = foreground_rgba.size
    fg_x, fg_y = fg_pos

    # 1. Extract the alpha mask of the product
    alpha = foreground_rgba.split()[3]

    # 2. Scale blur radius based on softness parameter
    blur_radius = max(2.0, (softness / 100.0) * 35.0)

    # 3. Create a dark shadow mask
    shadow_opacity = min(255, int((intensity / 100.0) * 160))
    
    # Shadow mask with target opacity
    shadow_alpha = alpha.point(lambda p: int((p / 255.0) * shadow_opacity) if p > 0 else 0)
    shadow_single = Image.new("RGBA", (fg_w, fg_h), (25, 28, 35, 0))
    shadow_single.putalpha(shadow_alpha)

    # 4. Canvas for the shadow
    shadow_canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    # Slightly shift shadow down for natural top-front lighting
    offset_y = int(max(4, fg_h * 0.035))
    shadow_canvas.paste(shadow_single, (fg_x, fg_y + offset_y), shadow_single)

    # 5. Apply Gaussian blur to make it soft and realistic
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    return shadow_canvas
