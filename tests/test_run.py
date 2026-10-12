import io
from PIL import Image, ImageDraw
import httpx

# 1. Create product image
img = Image.new("RGB", (400, 400), (240, 240, 240))
draw = ImageDraw.Draw(img)
draw.rounded_rectangle([150, 100, 250, 340], radius=16, fill=(28, 54, 98))
draw.rectangle([180, 60, 220, 100], fill=(212, 175, 55))
buf = io.BytesIO()
img.save(buf, format="PNG")
buf.seek(0)

print("Calling /api/process with httpx...")
with httpx.Client(base_url="http://127.0.0.1:8000", timeout=120.0) as client:
    files = {"image": ("perfume_bottle.png", buf.getvalue(), "image/png")}
    data = {
        "template_id": "premium_light",
        "scale": 85,
        "position_x": 50,
        "position_y": 50,
        "shadow_intensity": 45,
        "shadow_softness": 35,
        "output_format": "png"
    }
    response = client.post("/api/process", files=files, data=data)
    print("STATUS:", response.status_code)
    print("BODY:", response.json())
