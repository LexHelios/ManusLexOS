"""
LexOS Intelligent Model Router

This module handles the intelligent routing of requests to the appropriate model,
whether local on H100 or via Together API, based on task type, complexity,
and available resources.
"""

import os
import yaml
import json
from enum import Enum
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field
import time
from loguru import logger
from pathlib import Path

# Import model managers
from models.h100_manager import H100ModelManager
from models.together_client import TogetherClient
from models.shadow_agent import ShadowAgent

# Task types
class TaskType(str, Enum):
    CHAT = "chat"
    REASONING = "reasoning"
    CODE = "code"
    CREATIVE = "creative"
    VISION = "vision"
    IMAGE_GENERATION = "image_generation"
    SPEECH_TO_TEXT = "speech_to_text"
    TEXT_TO_SPEECH = "text_to_speech"
    UNRESTRICTED = "unrestricted"

# Model source
class ModelSource(str, Enum):
    LOCAL = "local"
    TOGETHER = "together"
    SHADOW = "shadow"

# Request model
class ModelRequest(BaseModel):
    prompt: str
    task_type: TaskType
    max_tokens: int = 1024
    temperature: float = 0.7
    top_p: float = 0.9
    stream: bool = False
    system_prompt: Optional[str] = None
    images: Optional[List[str]] = None
    audio: Optional[str] = None
    force_provider: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None

# Response model
class ModelResponse(BaseModel):
    text: str
    model_used: str
    provider: str
    tokens_used: int
    cost: float
    latency_ms: float
    metadata: Optional[Dict[str, Any]] = None

class ModelRouter:
    """Intelligent model router for LexOS"""
    
    def __init__(self, config_path: str = "/app/config/model_config.yaml"):
        """Initialize the model router with configuration"""
        self.config_path = config_path
        self.config = self._load_config()
        
        # Initialize model managers
        self.h100_manager = H100ModelManager(self.config["h100_models"])
        self.together_client = TogetherClient(self.config["together_models"])
        
        # Initialize shadow agent if enabled
        self.shadow_agent = None
        if os.environ.get("ENABLE_SHADOW_AGENT", "false").lower() == "true":
            self.shadow_agent = ShadowAgent(self.config["shadow_models"])
        
        # Load routing configuration
        self.routing_config = self.config["routing"]
        
        # Initialize cost tracking
        self.daily_api_cost = 0.0
        self.cost_reset_time = time.time()
        
        logger.info(f"Model router initialized with {len(self.config['h100_models']['text'])} local text models, "
                   f"{len(self.config['together_models'])} Together models")
    
    def _load_config(self) -> Dict:
        """Load model configuration from YAML file"""
        config_path = Path(self.config_path)
        if not config_path.exists():
            logger.error(f"Config file not found: {self.config_path}")
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        
        return config
    
    def _get_model_for_task(self, task_type: TaskType, request: ModelRequest) -> tuple[str, ModelSource]:
        """Get the best model for a given task type"""
        # Check if user requested a specific provider
        if request.force_provider:
            if request.force_provider == "local":
                return self._get_best_local_model(task_type), ModelSource.LOCAL
            elif request.force_provider == "together":
                return self._get_best_together_model(task_type), ModelSource.TOGETHER
            elif request.force_provider == "shadow":
                return self._get_best_shadow_model(), ModelSource.SHADOW
        
        # Check if this is an unrestricted request
        if task_type == TaskType.UNRESTRICTED and self.shadow_agent:
            return self._get_best_shadow_model(), ModelSource.SHADOW
        
        # Check if we should use local model (prefer local if available)
        if self.routing_config["cost_optimization"]["prefer_local"]:
            local_model = self._get_best_local_model(task_type)
            if local_model and self.h100_manager.can_run_model(local_model):
                return local_model, ModelSource.LOCAL
        
        # Check if we're under budget for API calls
        if self.daily_api_cost < self.routing_config["cost_optimization"]["max_daily_api_budget"]:
            # If request is long, use Together API
            if len(request.prompt) > self.routing_config["cost_optimization"]["token_threshold_for_api"]:
                together_model = self._get_best_together_model(task_type)
                if together_model:
                    return together_model, ModelSource.TOGETHER
        
        # Fallback to local model
        local_model = self._get_best_local_model(task_type)
        if local_model:
            return local_model, ModelSource.LOCAL
        
        # Ultimate fallback to any Together model
        return self._get_best_together_model(task_type), ModelSource.TOGETHER
    
    def _get_best_local_model(self, task_type: TaskType) -> Optional[str]:
        """Get the best local model for a task type"""
        task_mapping = self.routing_config["task_mapping"].get(task_type, [])
        for mapping in task_mapping:
            if "local" in mapping:
                return mapping["local"]
        return None
    
    def _get_best_together_model(self, task_type: TaskType) -> Optional[str]:
        """Get the best Together model for a task type"""
        task_mapping = self.routing_config["task_mapping"].get(task_type, [])
        for mapping in task_mapping:
            if "together" in mapping:
                return mapping["together"]
        return None
    
    def _get_best_shadow_model(self) -> str:
        """Get the best shadow model"""
        if not self.shadow_agent or not self.config["shadow_models"]:
            return None
        return self.config["shadow_models"][0]["name"]
    
    def _update_cost_tracking(self, cost: float):
        """Update the daily API cost tracking"""
        # Reset daily cost if it's been more than 24 hours
        current_time = time.time()
        if current_time - self.cost_reset_time > 86400:  # 24 hours in seconds
            self.daily_api_cost = 0.0
            self.cost_reset_time = current_time
        
        # Add the cost
        self.daily_api_cost += cost
    
    async def route_request(self, request: ModelRequest) -> ModelResponse:
        """Route a request to the appropriate model and return the response"""
        start_time = time.time()
        
        # Determine the best model and source for this request
        model_name, model_source = self._get_model_for_task(request.task_type, request)
        
        logger.info(f"Routing request to {model_source.value} model: {model_name}")
        
        # Process the request based on the model source
        if model_source == ModelSource.LOCAL:
            # Use local H100 model
            result = await self.h100_manager.generate(
                model_name=model_name,
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                stream=request.stream,
                images=request.images,
                audio=request.audio
            )
            cost = 0.0  # Local models have no API cost
            
        elif model_source == ModelSource.TOGETHER:
            # Use Together API
            result = await self.together_client.generate(
                model_name=model_name,
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                stream=request.stream
            )
            cost = result.get("cost", 0.0)
            self._update_cost_tracking(cost)
            
        elif model_source == ModelSource.SHADOW and self.shadow_agent:
            # Use shadow agent (unrestricted)
            result = await self.shadow_agent.generate(
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p
            )
            cost = 0.0  # Shadow agent is local
        
        else:
            raise ValueError(f"Unsupported model source: {model_source}")
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Create and return the response
        response = ModelResponse(
            text=result.get("text", ""),
            model_used=model_name,
            provider=model_source.value,
            tokens_used=result.get("tokens_used", 0),
            cost=cost,
            latency_ms=latency_ms,
            metadata={
                "task_type": request.task_type,
                "model_source": model_source.value,
                "daily_api_cost": self.daily_api_cost
            }
        )
        
        return response

