import secrets

def generate_id(length: int = 16) -> str:
    """Generate an unguessable URL-safe identifier."""
    return secrets.token_urlsafe(length)
