"""
Together AI Client

This module provides a client for the Together AI API, which offers
cost-effective access to powerful LLMs like Qwen2.5, DeepSeek-R1, and more.
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
import time
from loguru import logger
import httpx

class TogetherClient:
    """Client for Together AI API"""
    
    def __init__(self, model_config: List[Dict]):
        """Initialize the Together AI client"""
        self.api_key = os.environ.get("TOGETHER_API_KEY")
        if not self.api_key:
            logger.warning("TOGETHER_API_KEY not set, Together AI features will be unavailable")
        
        self.model_config = {model["name"]: model for model in model_config}
        self.base_url = "https://api.together.xyz/v1"
        self.client = httpx.AsyncClient(timeout=60.0)
        
        logger.info(f"Together AI client initialized with {len(model_config)} models")
    
    def _get_model_id(self, model_name: str) -> str:
        """Get the Together AI model ID for a given model name"""
        if model_name not in self.model_config:
            raise ValueError(f"Model {model_name} not found in configuration")
        
        return self.model_config[model_name]["model_id"]
    
    def _calculate_cost(self, model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculate the cost of a request based on token usage"""
        if model_name not in self.model_config:
            return 0.0
        
        # Get cost per million tokens
        cost_per_1m = self.model_config[model_name].get("cost_per_1m_tokens", 0.0)
        
        # Calculate cost (prompt tokens are typically cheaper, but we'll use the same rate for simplicity)
        total_tokens = prompt_tokens + completion_tokens
        cost = (total_tokens / 1_000_000) * cost_per_1m
        
        return cost
    
    async def generate(
        self,
        model_name: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Generate text using the Together AI API"""
        if not self.api_key:
            raise ValueError("TOGETHER_API_KEY not set")
        
        # Get the model ID
        model_id = self._get_model_id(model_name)
        
        # Prepare the request
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Format messages for chat models
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # Prepare the payload
        payload = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "stream": stream
        }
        
        start_time = time.time()
        
        try:
            # Make the API request
            response = await self.client.post(
                f"{self.base_url}/completions",
                headers=headers,
                json=payload
            )
            
            # Check for errors
            response.raise_for_status()
            
            # Parse the response
            result = response.json()
            
            # Extract the generated text
            if "choices" in result and len(result["choices"]) > 0:
                generated_text = result["choices"][0]["message"]["content"]
            else:
                generated_text = ""
            
            # Get token usage
            prompt_tokens = result.get("usage", {}).get("prompt_tokens", 0)
            completion_tokens = result.get("usage", {}).get("completion_tokens", 0)
            total_tokens = prompt_tokens + completion_tokens
            
            # Calculate cost
            cost = self._calculate_cost(model_name, prompt_tokens, completion_tokens)
            
            # Calculate latency
            latency = time.time() - start_time
            
            return {
                "text": generated_text,
                "tokens_used": total_tokens,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cost": cost,
                "latency": latency,
                "model": model_id
            }
            
        except Exception as e:
            logger.error(f"Error calling Together AI API: {str(e)}")
            return {
                "text": f"Error: {str(e)}",
                "tokens_used": 0,
                "cost": 0.0,
                "latency": time.time() - start_time,
                "error": str(e)
            }
    
    async def list_models(self) -> List[Dict]:
        """List available models on Together AI"""
        if not self.api_key:
            raise ValueError("TOGETHER_API_KEY not set")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        try:
            response = await self.client.get(
                f"{self.base_url}/models",
                headers=headers
            )
            
            response.raise_for_status()
            result = response.json()
            
            return result.get("data", [])
            
        except Exception as e:
            logger.error(f"Error listing Together AI models: {str(e)}")
            return []

