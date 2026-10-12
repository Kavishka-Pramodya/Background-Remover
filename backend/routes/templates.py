import io
from fastapi import APIRouter, Response, HTTPException
from backend.services.templates import TEMPLATES

router = APIRouter()

@router.get("/templates")
async def list_templates():
    items = []
    for t_id, t_data in TEMPLATES.items():
        items.append({
            "id": t_data["id"],
            "name": t_data["name"],
            "description": t_data["description"],
            "preview_url": f"/api/templates/{t_id}/preview",
            "defaults": t_data["defaults"]
        })
    return {"templates": items}

@router.get("/templates/{template_id}/preview")
async def get_template_preview(template_id: str):
    if template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Render preview thumbnail at 200x200
    tpl = TEMPLATES[template_id]
    preview_img = tpl["renderer"](200, 200)
    
    buf = io.BytesIO()
    preview_img.save(buf, format="PNG")
    buf.seek(0)
    
    return Response(content=buf.getvalue(), media_type="image/png")
