import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.compositor import composite_product_image
from backend.services.templates import TEMPLATES

client = TestClient(app)

def create_synthetic_image(width=300, height=300, color=(255, 0, 0), format="PNG"):
    """Generate in-memory test image."""
    img = Image.new("RGBA" if format == "PNG" else "RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model_loaded" in data

def test_templates_endpoint():
    response = client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert "templates" in data
    assert len(data["templates"]) == 3
    template_ids = [t["id"] for t in data["templates"]]
    assert "premium_light" in template_ids
    assert "soft_gray" in template_ids
    assert "warm_neutral" in template_ids

def test_template_preview_endpoint():
    response = client.get("/api/templates/premium_light/preview")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

def test_template_preview_not_found():
    response = client.get("/api/templates/invalid_template/preview")
    assert response.status_code == 404

def test_compositor_output_dimensions():
    # Test compositing directly
    fg = Image.new("RGBA", (200, 200), (255, 0, 0, 255))
    result = composite_product_image(
        cutout_rgba=fg,
        template_id="premium_light",
        scale_pct=80,
        pos_x_pct=50,
        pos_y_pct=50,
        shadow_intensity=40,
        shadow_softness=30
    )
    assert result.size == (1200, 1200)
    assert result.mode == "RGBA"

def test_upload_corrupt_file_rejected():
    files = {"image": ("test.png", b"not-a-valid-image-content", "image/png")}
    response = client.post("/api/process", files=files, data={"template_id": "premium_light"})
    assert response.status_code == 400
