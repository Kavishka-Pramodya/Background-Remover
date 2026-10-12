import math
from typing import Dict, Any, Callable
from PIL import Image, ImageDraw

def render_radial_gradient(width: int, height: int, inner_color: tuple, outer_color: tuple) -> Image.Image:
    """Render a smooth 2-color radial gradient canvas."""
    base = Image.new("RGB", (width, height), outer_color)
    draw = ImageDraw.Draw(base)

    cx, cy = width / 2.0, height * 0.45  # Center slightly higher for product focus
    max_radius = math.hypot(width / 2.0, height / 2.0)

    # Render concentric smooth circles
    steps = 100
    for i in range(steps, 0, -1):
        ratio = i / float(steps)
        r = max_radius * ratio
        # Interpolate color
        curr_color = tuple(
            int(inner_color[c] + (outer_color[c] - inner_color[c]) * (ratio ** 1.3))
            for c in range(3)
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=curr_color)
    
    return base

def render_linear_gradient(width: int, height: int, top_color: tuple, bottom_color: tuple) -> Image.Image:
    """Render a smooth vertical linear gradient canvas."""
    base = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(base)
    for y in range(height):
        ratio = y / float(height)
        color = tuple(
            int(top_color[c] + (bottom_color[c] - top_color[c]) * ratio)
            for c in range(3)
        )
        draw.line([(0, y), (width, y)], fill=color)
    return base

def render_premium_light(width: int, height: int) -> Image.Image:
    """Clean white-to-light-gray studio gradient with subtle depth."""
    return render_radial_gradient(width, height, (255, 255, 255), (238, 240, 243))

def render_soft_gray(width: int, height: int) -> Image.Image:
    """Soft balanced gray studio surface."""
    return render_radial_gradient(width, height, (246, 247, 249), (220, 224, 229))

def render_warm_neutral(width: int, height: int) -> Image.Image:
    """Warm beige / natural aesthetic studio background."""
    return render_radial_gradient(width, height, (253, 250, 246), (232, 224, 215))

TEMPLATES: Dict[str, Dict[str, Any]] = {
    "premium_light": {
        "id": "premium_light",
        "name": "Premium Light Studio",
        "description": "Ultra-clean white with subtle studio vignette. Ideal for electronics, cosmetics, and accessories.",
        "renderer": render_premium_light,
        "defaults": {
            "scale": 80,
            "position_x": 50,
            "position_y": 50,
            "shadow_intensity": 40,
            "shadow_softness": 30
        }
    },
    "soft_gray": {
        "id": "soft_gray",
        "name": "Soft Gray Studio",
        "description": "Modern neutral gray studio atmosphere with soft lighting depth.",
        "renderer": render_soft_gray,
        "defaults": {
            "scale": 80,
            "position_x": 50,
            "position_y": 50,
            "shadow_intensity": 45,
            "shadow_softness": 35
        }
    },
    "warm_neutral": {
        "id": "warm_neutral",
        "name": "Warm Neutral Studio",
        "description": "Warm organic beige tones for jewelry, skincare, and lifestyle products.",
        "renderer": render_warm_neutral,
        "defaults": {
            "scale": 80,
            "position_x": 50,
            "position_y": 50,
            "shadow_intensity": 35,
            "shadow_softness": 40
        }
    }
}

def get_template(template_id: str) -> Dict[str, Any]:
    return TEMPLATES.get(template_id, TEMPLATES["premium_light"])
