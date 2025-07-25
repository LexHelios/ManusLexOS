#!/bin/bash
set -e

# Download models if needed
if [ ! -f "/app/models/.models_downloaded" ]; then
    echo "Downloading required models..."
    /app/scripts/download_models.sh
    touch /app/models/.models_downloaded
fi

# Check if we need to run database migrations
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    python3 -m alembic upgrade head
fi

# Start the application
echo "Starting LexOS H100 Command Center..."
exec uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4

