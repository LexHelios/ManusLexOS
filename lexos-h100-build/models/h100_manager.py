"""
H100 Model Manager

This module manages the local models running on the H100 GPU using vLLM.
It handles model loading, unloading, and inference.
"""

import os
import asyncio
import json
from typing import Dict, List, Optional, Any, Union
import time
from loguru import logger
import torch
from pathlib import Path

# Import vLLM for efficient inference
try:
    from vllm import LLM, SamplingParams
    from vllm.outputs import RequestOutput
    VLLM_AVAILABLE = True
except ImportError:
    logger.warning("vLLM not available, falling back to transformers")
    VLLM_AVAILABLE = False
    
    # Fallback to transformers
    from transformers import (
        AutoModelForCausalLM, 
        AutoTokenizer,
        pipeline,
        StoppingCriteria,
        StoppingCriteriaList
    )

# Import for image and audio processing
try:
    from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
    from transformers import WhisperProcessor, WhisperForConditionalGeneration
    DIFFUSERS_AVAILABLE = True
except ImportError:
    logger.warning("Diffusers or audio processing libraries not available")
    DIFFUSERS_AVAILABLE = False

class H100ModelManager:
    """Manager for H100-based local models"""
    
    def __init__(self, model_config: Dict):
        """Initialize the H100 model manager"""
        self.model_config = model_config
        self.loaded_models = {}
        self.model_locks = {}
        self.gpu_memory = self._get_gpu_memory()
        
        # Initialize model locks
        for model_type in model_config:
            for model in model_config[model_type]:
                self.model_locks[model["name"]] = asyncio.Lock()
        
        # Preload models if specified in config
        self._preload_models()
        
        logger.info(f"H100 Model Manager initialized with {self.gpu_memory}GB GPU memory")
    
    def _get_gpu_memory(self) -> int:
        """Get the available GPU memory in GB"""
        if torch.cuda.is_available():
            # Get the total memory of the first GPU (H100)
            return torch.cuda.get_device_properties(0).total_memory / (1024**3)
        else:
            logger.warning("CUDA not available, assuming 80GB H100")
            return 80  # Assume H100 with 80GB
    
    def _preload_models(self):
        """Preload models specified in the configuration"""
        # This would be implemented to preload models in a separate thread
        # For now, we'll just log that we would preload
        logger.info("Model preloading would happen here in production")
    
    def can_run_model(self, model_name: str) -> bool:
        """Check if a model can run on the current GPU"""
        # Find the model in the config
        model_info = None
        for model_type in self.model_config:
            for model in self.model_config[model_type]:
                if model["name"] == model_name:
                    model_info = model
                    break
            if model_info:
                break
        
        if not model_info:
            return False
        
        # Check if the model requires more VRAM than available
        required_vram = model_info.get("vram_required_gb", 0)
        return required_vram <= self.gpu_memory
    
    async def _load_model(self, model_name: str):
        """Load a model into memory"""
        # Find the model in the config
        model_info = None
        model_type = None
        for mtype in self.model_config:
            for model in self.model_config[mtype]:
                if model["name"] == model_name:
                    model_info = model
                    model_type = mtype
                    break
            if model_info:
                break
        
        if not model_info:
            raise ValueError(f"Model {model_name} not found in configuration")
        
        # Check if model is already loaded
        if model_name in self.loaded_models:
            return
        
        logger.info(f"Loading model {model_name} ({model_type})")
        
        # Load the model based on its type
        if model_type == "text" or model_type == "code":
            if VLLM_AVAILABLE:
                # Use vLLM for text models
                model_path = model_info["path"]
                quantization = model_info.get("quantization", None)
                tensor_parallel = model_info.get("tensor_parallel", 1)
                
                # Set quantization if specified
                dtype = "auto"
                if quantization == "int8":
                    dtype = "int8"
                elif quantization == "int4":
                    dtype = "int4"
                
                # Load the model with vLLM
                llm = LLM(
                    model=model_path,
                    tensor_parallel_size=tensor_parallel,
                    dtype=dtype,
                    gpu_memory_utilization=0.9,
                    trust_remote_code=True
                )
                
                self.loaded_models[model_name] = {
                    "model": llm,
                    "type": model_type,
                    "info": model_info
                }
            else:
                # Fallback to transformers
                model_path = model_info["path"]
                quantization = model_info.get("quantization", None)
                
                # Set quantization if specified
                if quantization == "int8":
                    model = AutoModelForCausalLM.from_pretrained(
                        model_path, 
                        device_map="auto", 
                        load_in_8bit=True,
                        trust_remote_code=True
                    )
                elif quantization == "int4":
                    model = AutoModelForCausalLM.from_pretrained(
                        model_path, 
                        device_map="auto", 
                        load_in_4bit=True,
                        trust_remote_code=True
                    )
                else:
                    model = AutoModelForCausalLM.from_pretrained(
                        model_path, 
                        device_map="auto",
                        trust_remote_code=True
                    )
                
                tokenizer = AutoTokenizer.from_pretrained(model_path)
                
                self.loaded_models[model_name] = {
                    "model": model,
                    "tokenizer": tokenizer,
                    "type": model_type,
                    "info": model_info
                }
        
        elif model_type == "vision" and DIFFUSERS_AVAILABLE:
            # Load vision model
            model_path = model_info["path"]
            
            # For LLaVA or similar
            from transformers import AutoProcessor, LlavaForConditionalGeneration
            
            model = LlavaForConditionalGeneration.from_pretrained(
                model_path,
                device_map="auto",
                trust_remote_code=True
            )
            processor = AutoProcessor.from_pretrained(model_path)
            
            self.loaded_models[model_name] = {
                "model": model,
                "processor": processor,
                "type": "vision",
                "info": model_info
            }
        
        elif model_type == "image" and DIFFUSERS_AVAILABLE:
            # Load image generation model (Stable Diffusion)
            model_path = model_info["path"]
            
            pipe = StableDiffusionXLPipeline.from_pretrained(
                model_path,
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True
            )
            pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
            pipe = pipe.to("cuda")
            
            self.loaded_models[model_name] = {
                "model": pipe,
                "type": "image",
                "info": model_info
            }
        
        elif model_type == "speech-to-text" and DIFFUSERS_AVAILABLE:
            # Load Whisper model
            model_path = model_info["path"]
            
            processor = WhisperProcessor.from_pretrained(model_path)
            model = WhisperForConditionalGeneration.from_pretrained(
                model_path,
                device_map="auto"
            )
            
            self.loaded_models[model_name] = {
                "model": model,
                "processor": processor,
                "type": "speech-to-text",
                "info": model_info
            }
        
        elif model_type == "text-to-speech":
            # For XTTS, we'd use a client to the XTTS server
            # This is a simplified implementation
            self.loaded_models[model_name] = {
                "type": "text-to-speech",
                "info": model_info
            }
        
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
        
        logger.info(f"Model {model_name} loaded successfully")
    
    async def _unload_model(self, model_name: str):
        """Unload a model from memory"""
        if model_name not in self.loaded_models:
            return
        
        logger.info(f"Unloading model {model_name}")
        
        # Get model info
        model_info = self.loaded_models[model_name]
        
        # Unload based on type
        if model_info["type"] in ["text", "code"]:
            # For vLLM or transformers, we can just delete the reference
            # and let Python's garbage collection handle it
            pass
        
        # Remove from loaded models
        del self.loaded_models[model_name]
        
        # Force garbage collection
        import gc
        gc.collect()
        
        # Clear CUDA cache if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info(f"Model {model_name} unloaded successfully")
    
    async def generate(
        self, 
        model_name: str, 
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stream: bool = False,
        images: Optional[List[str]] = None,
        audio: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate text using a local model"""
        # Acquire lock for this model
        async with self.model_locks[model_name]:
            # Load the model if not already loaded
            if model_name not in self.loaded_models:
                await self._load_model(model_name)
            
            # Get model info
            model_info = self.loaded_models[model_name]
            model_type = model_info["type"]
            
            # Generate based on model type
            if model_type in ["text", "code"]:
                return await self._generate_text(
                    model_name=model_name,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stream=stream
                )
            elif model_type == "vision":
                return await self._generate_vision(
                    model_name=model_name,
                    prompt=prompt,
                    images=images,
                    max_tokens=max_tokens
                )
            elif model_type == "image":
                return await self._generate_image(
                    model_name=model_name,
                    prompt=prompt
                )
            elif model_type == "speech-to-text":
                return await self._transcribe_audio(
                    model_name=model_name,
                    audio_path=audio
                )
            elif model_type == "text-to-speech":
                return await self._generate_speech(
                    model_name=model_name,
                    text=prompt
                )
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
    
    async def _generate_text(
        self,
        model_name: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Generate text using a text model"""
        model_info = self.loaded_models[model_name]
        
        # Format the prompt with system prompt if provided
        formatted_prompt = prompt
        if system_prompt:
            formatted_prompt = f"{system_prompt}\n\n{prompt}"
        
        start_time = time.time()
        
        # Generate using vLLM if available
        if VLLM_AVAILABLE and isinstance(model_info["model"], LLM):
            llm = model_info["model"]
            
            # Set sampling parameters
            sampling_params = SamplingParams(
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p
            )
            
            # Generate
            outputs = llm.generate(formatted_prompt, sampling_params)
            
            # Extract the generated text
            generated_text = outputs[0].outputs[0].text
            
            # Calculate tokens used (approximate)
            tokens_used = len(formatted_prompt.split()) + len(generated_text.split())
            
        else:
            # Fallback to transformers
            model = model_info["model"]
            tokenizer = model_info["tokenizer"]
            
            # Tokenize input
            inputs = tokenizer(formatted_prompt, return_tensors="pt").to("cuda")
            
            # Generate
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=temperature > 0.0
                )
            
            # Decode the generated text
            generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            generated_text = generated_text[len(formatted_prompt):]
            
            # Calculate tokens used
            tokens_used = len(inputs.input_ids[0]) + len(outputs[0]) - len(inputs.input_ids[0])
        
        # Calculate latency
        latency = time.time() - start_time
        
        return {
            "text": generated_text,
            "tokens_used": tokens_used,
            "latency": latency
        }
    
    async def _generate_vision(
        self,
        model_name: str,
        prompt: str,
        images: Optional[List[str]] = None,
        max_tokens: int = 1024
    ) -> Dict[str, Any]:
        """Generate text based on images using a vision model"""
        if not images:
            raise ValueError("Images are required for vision models")
        
        model_info = self.loaded_models[model_name]
        model = model_info["model"]
        processor = model_info["processor"]
        
        start_time = time.time()
        
        # Process images and text
        from PIL import Image
        
        # Load the first image
        image = Image.open(images[0])
        
        # Process inputs
        inputs = processor(prompt, image, return_tensors="pt").to("cuda")
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens
            )
        
        # Decode the generated text
        generated_text = processor.decode(outputs[0], skip_special_tokens=True)
        
        # Calculate latency
        latency = time.time() - start_time
        
        return {
            "text": generated_text,
            "tokens_used": len(outputs[0]),
            "latency": latency
        }
    
    async def _generate_image(
        self,
        model_name: str,
        prompt: str
    ) -> Dict[str, Any]:
        """Generate an image using a diffusion model"""
        model_info = self.loaded_models[model_name]
        pipe = model_info["model"]
        
        start_time = time.time()
        
        # Generate image
        image = pipe(
            prompt=prompt,
            num_inference_steps=30,
            guidance_scale=7.5
        ).images[0]
        
        # Save the image to a temporary file
        import tempfile
        import os
        
        temp_dir = tempfile.mkdtemp()
        image_path = os.path.join(temp_dir, "generated_image.png")
        image.save(image_path)
        
        # Calculate latency
        latency = time.time() - start_time
        
        return {
            "text": f"Image generated and saved to {image_path}",
            "image_path": image_path,
            "latency": latency
        }
    
    async def _transcribe_audio(
        self,
        model_name: str,
        audio_path: str
    ) -> Dict[str, Any]:
        """Transcribe audio using a speech-to-text model"""
        if not audio_path:
            raise ValueError("Audio path is required for speech-to-text models")
        
        model_info = self.loaded_models[model_name]
        model = model_info["model"]
        processor = model_info["processor"]
        
        start_time = time.time()
        
        # Load audio
        import librosa
        audio, _ = librosa.load(audio_path, sr=16000)
        
        # Process audio
        input_features = processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features.to("cuda")
        
        # Generate
        with torch.no_grad():
            predicted_ids = model.generate(input_features)
        
        # Decode the transcription
        transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
        
        # Calculate latency
        latency = time.time() - start_time
        
        return {
            "text": transcription,
            "latency": latency
        }
    
    async def _generate_speech(
        self,
        model_name: str,
        text: str
    ) -> Dict[str, Any]:
        """Generate speech from text using a text-to-speech model"""
        # This would typically call an XTTS server
        # For now, we'll just return a placeholder
        
        return {
            "text": "Speech would be generated here in production",
            "latency": 1.0
        }

