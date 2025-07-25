"""
Shadow Agent

This module provides a shadow agent for handling unrestricted content requests.
It uses uncensored models that run locally on the H100 for complete privacy.
"""

import os
import asyncio
from typing import Dict, List, Optional, Any
import time
from loguru import logger
import torch
from pathlib import Path

# Import transformers for model loading
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer,
    pipeline
)

class ShadowAgent:
    """Shadow agent for unrestricted content"""
    
    def __init__(self, model_config: List[Dict]):
        """Initialize the shadow agent"""
        self.model_config = {model["name"]: model for model in model_config}
        self.loaded_models = {}
        self.model_locks = {}
        
        # Initialize model locks
        for model_name in self.model_config:
            self.model_locks[model_name] = asyncio.Lock()
        
        # Check if shadow agent is enabled
        self.enabled = os.environ.get("ENABLE_SHADOW_AGENT", "false").lower() == "true"
        if not self.enabled:
            logger.warning("Shadow agent is disabled. Set ENABLE_SHADOW_AGENT=true to enable.")
        else:
            logger.info(f"Shadow agent initialized with {len(model_config)} models")
    
    async def _load_model(self, model_name: str):
        """Load a shadow model into memory"""
        if not self.enabled:
            raise ValueError("Shadow agent is disabled")
        
        if model_name not in self.model_config:
            raise ValueError(f"Model {model_name} not found in configuration")
        
        # Check if model is already loaded
        if model_name in self.loaded_models:
            return
        
        # Get model info
        model_info = self.model_config[model_name]
        model_path = model_info["path"]
        quantization = model_info.get("quantization", None)
        
        logger.info(f"Loading shadow model {model_name}")
        
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
        
        # Store the loaded model
        self.loaded_models[model_name] = {
            "model": model,
            "tokenizer": tokenizer,
            "info": model_info
        }
        
        logger.info(f"Shadow model {model_name} loaded successfully")
    
    async def _unload_model(self, model_name: str):
        """Unload a shadow model from memory"""
        if model_name not in self.loaded_models:
            return
        
        logger.info(f"Unloading shadow model {model_name}")
        
        # Remove from loaded models
        del self.loaded_models[model_name]
        
        # Force garbage collection
        import gc
        gc.collect()
        
        # Clear CUDA cache if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info(f"Shadow model {model_name} unloaded successfully")
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate text using a shadow model"""
        if not self.enabled:
            return {
                "text": "Shadow agent is disabled. Set ENABLE_SHADOW_AGENT=true to enable.",
                "tokens_used": 0,
                "latency": 0.0
            }
        
        # If no model specified, use the first one
        if not model_name:
            model_name = list(self.model_config.keys())[0]
        
        # Acquire lock for this model
        async with self.model_locks[model_name]:
            # Load the model if not already loaded
            if model_name not in self.loaded_models:
                await self._load_model(model_name)
            
            # Get model info
            model_info = self.loaded_models[model_name]
            model = model_info["model"]
            tokenizer = model_info["tokenizer"]
            
            # Format the prompt with system prompt if provided
            formatted_prompt = prompt
            if system_prompt:
                formatted_prompt = f"{system_prompt}\n\n{prompt}"
            
            start_time = time.time()
            
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
                "latency": latency,
                "model": model_name
            }

