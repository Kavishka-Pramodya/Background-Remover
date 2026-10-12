FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860 \
    U2NET_HOME=/app/models

WORKDIR /app

# Install system dependencies for OpenCV and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the u2net model into the image so there is ZERO cold-start delay
RUN mkdir -p /app/models && \
    python -c "import os; os.environ['U2NET_HOME'] = '/app/models'; from rembg import new_session; new_session('u2net')"

# Copy backend code
COPY backend ./backend

# Hugging Face Spaces runs on port 7860 by default
EXPOSE 7860

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
