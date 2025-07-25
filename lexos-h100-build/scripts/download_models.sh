#!/bin/bash
set -e

MODELS_DIR="/app/models"
mkdir -p $MODELS_DIR

# Function to download Hugging Face models
download_hf_model() {
    MODEL_NAME=$1
    echo "Downloading $MODEL_NAME..."
    python3 -c "from huggingface_hub import snapshot_download; snapshot_download('$MODEL_NAME', local_dir='$MODELS_DIR/$MODEL_NAME', local_dir_use_symlinks=False)"
    echo "Downloaded $MODEL_NAME successfully"
}

# Download essential models for H100
echo "Downloading essential models for H100 inference..."

# Fast local models
download_hf_model "meta-llama/Llama-3.1-8B-Instruct"
download_hf_model "codellama/CodeLlama-7b-Instruct-hf"
download_hf_model "mistralai/Mistral-7B-Instruct-v0.2"

# Image generation
download_hf_model "stabilityai/stable-diffusion-xl-base-1.0"

# Speech models
download_hf_model "openai/whisper-large-v3"
download_hf_model "coqui/XTTS-v2"

# Vision model
download_hf_model "llava-hf/llava-1.6-34b-hf"

echo "All models downloaded successfully!"

