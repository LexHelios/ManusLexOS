"""
LexOS H100 Command Center API

This is the main FastAPI application for the LexOS H100 Command Center.
It provides endpoints for chat, image generation, speech processing,
and agent management.
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
import time
from datetime import datetime
from loguru import logger
from pathlib import Path

# FastAPI imports
from fastapi import FastAPI, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Import components
from orchestrator.router import ModelRouter, ModelRequest, ModelResponse, TaskType
from memory.memory_system import MemorySystem
from agents.crew_manager import CrewAIManager
from agents.langchain_tools import LangChainToolManager
from models.h100_manager import H100ModelManager
from models.together_client import TogetherClient
from models.shadow_agent import ShadowAgent

# Create FastAPI app
app = FastAPI(
    title="LexOS H100 Command Center",
    description="AI command center powered by H100 GPU and Together AI",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
model_router = None
memory_system = None
crew_manager = None
langchain_tool_manager = None

# WebSocket connections
websocket_connections = {}

# Request models
class ChatRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None
    system_prompt: Optional[str] = None
    max_tokens: int = 1024
    temperature: float = 0.7
    top_p: float = 0.9
    stream: bool = False
    user_id: Optional[str] = None
    force_provider: Optional[str] = None
    task_type: str = "chat"

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 30
    guidance_scale: float = 7.5
    user_id: Optional[str] = None

class SpeechToTextRequest(BaseModel):
    audio_path: str
    user_id: Optional[str] = None

class TextToSpeechRequest(BaseModel):
    text: str
    voice: str = "default"
    user_id: Optional[str] = None

class CrewRequest(BaseModel):
    crew_name: str
    agent_templates: List[str]
    tasks: List[Dict]
    process_type: str = "sequential"
    user_id: Optional[str] = None

class MemoryStoreRequest(BaseModel):
    text: str
    metadata: Optional[Dict] = None
    user_id: Optional[str] = None
    memory_type: str = "general"

class MemoryRetrieveRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    memory_type: Optional[str] = None
    limit: int = 5

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize components on startup"""
    global model_router, memory_system, crew_manager, langchain_tool_manager
    
    logger.info("Starting LexOS H100 Command Center API")
    
    # Load configuration
    config_path = os.environ.get("CONFIG_PATH", "/app/config/model_config.yaml")
    
    # Initialize model router
    try:
        model_router = ModelRouter(config_path=config_path)
        logger.info("Model router initialized")
    except Exception as e:
        logger.error(f"Error initializing model router: {str(e)}")
        model_router = None
    
    # Initialize memory system
    try:
        memory_system = MemorySystem()
        logger.info("Memory system initialized")
    except Exception as e:
        logger.error(f"Error initializing memory system: {str(e)}")
        memory_system = None
    
    # Initialize CrewAI manager
    try:
        h100_manager = H100ModelManager(model_router.config["h100_models"]) if model_router else None
        together_client = TogetherClient(model_router.config["together_models"]) if model_router else None
        
        crew_manager = CrewAIManager(
            h100_manager=h100_manager,
            together_client=together_client
        )
        logger.info("CrewAI manager initialized")
    except Exception as e:
        logger.error(f"Error initializing CrewAI manager: {str(e)}")
        crew_manager = None
    
    # Initialize LangChain tool manager
    try:
        langchain_tool_manager = LangChainToolManager()
        logger.info("LangChain tool manager initialized")
    except Exception as e:
        logger.error(f"Error initializing LangChain tool manager: {str(e)}")
        langchain_tool_manager = None
    
    logger.info("LexOS H100 Command Center API started successfully")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down LexOS H100 Command Center API")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "model_router": model_router is not None,
            "memory_system": memory_system is not None,
            "crew_manager": crew_manager is not None,
            "langchain_tool_manager": langchain_tool_manager is not None
        },
        "version": "1.0.0"
    }

# Chat endpoint
@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat with an AI model"""
    if not model_router:
        raise HTTPException(status_code=503, detail="Model router not available")
    
    try:
        # Convert task type
        task_type = TaskType(request.task_type)
        
        # Create model request
        model_request = ModelRequest(
            prompt=request.prompt,
            task_type=task_type,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            stream=request.stream,
            system_prompt=request.system_prompt,
            force_provider=request.force_provider,
            user_id=request.user_id
        )
        
        # Route the request
        response = await model_router.route_request(model_request)
        
        # Store in memory if conversation_id provided
        if memory_system and request.conversation_id:
            await memory_system.store_conversation(
                conversation_id=request.conversation_id,
                user_message=request.prompt,
                assistant_message=response.text,
                metadata={
                    "model_used": response.model_used,
                    "provider": response.provider,
                    "tokens_used": response.tokens_used,
                    "cost": response.cost
                }
            )
        
        return response.dict()
    
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Image generation endpoint
@app.post("/api/image")
async def generate_image(request: ImageRequest):
    """Generate an image"""
    if not model_router:
        raise HTTPException(status_code=503, detail="Model router not available")
    
    try:
        # Create model request
        model_request = ModelRequest(
            prompt=request.prompt,
            task_type=TaskType.IMAGE_GENERATION,
            metadata={
                "negative_prompt": request.negative_prompt,
                "width": request.width,
                "height": request.height,
                "num_inference_steps": request.num_inference_steps,
                "guidance_scale": request.guidance_scale
            },
            user_id=request.user_id
        )
        
        # Route the request
        response = await model_router.route_request(model_request)
        
        return response.dict()
    
    except Exception as e:
        logger.error(f"Error in image generation endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Speech-to-text endpoint
@app.post("/api/speech-to-text")
async def speech_to_text(request: SpeechToTextRequest):
    """Convert speech to text"""
    if not model_router:
        raise HTTPException(status_code=503, detail="Model router not available")
    
    try:
        # Create model request
        model_request = ModelRequest(
            prompt="Transcribe the audio",
            task_type=TaskType.SPEECH_TO_TEXT,
            audio=request.audio_path,
            user_id=request.user_id
        )
        
        # Route the request
        response = await model_router.route_request(model_request)
        
        return response.dict()
    
    except Exception as e:
        logger.error(f"Error in speech-to-text endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Text-to-speech endpoint
@app.post("/api/text-to-speech")
async def text_to_speech(request: TextToSpeechRequest):
    """Convert text to speech"""
    if not model_router:
        raise HTTPException(status_code=503, detail="Model router not available")
    
    try:
        # Create model request
        model_request = ModelRequest(
            prompt=request.text,
            task_type=TaskType.TEXT_TO_SPEECH,
            metadata={"voice": request.voice},
            user_id=request.user_id
        )
        
        # Route the request
        response = await model_router.route_request(model_request)
        
        return response.dict()
    
    except Exception as e:
        logger.error(f"Error in text-to-speech endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Crew endpoints
@app.post("/api/crew/create")
async def create_crew(request: CrewRequest):
    """Create a crew of agents"""
    if not crew_manager:
        raise HTTPException(status_code=503, detail="CrewAI manager not available")
    
    try:
        crew_id = await crew_manager.create_crew(
            crew_name=request.crew_name,
            agent_templates=request.agent_templates,
            tasks=request.tasks,
            process_type=request.process_type
        )
        
        return {"crew_id": crew_id}
    
    except Exception as e:
        logger.error(f"Error creating crew: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/crew/{crew_id}/run")
async def run_crew(crew_id: str):
    """Run a crew's tasks"""
    if not crew_manager:
        raise HTTPException(status_code=503, detail="CrewAI manager not available")
    
    try:
        result = await crew_manager.run_crew(crew_id)
        return result
    
    except Exception as e:
        logger.error(f"Error running crew: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crew/{crew_id}/status")
async def get_crew_status(crew_id: str):
    """Get the status of a crew"""
    if not crew_manager:
        raise HTTPException(status_code=503, detail="CrewAI manager not available")
    
    try:
        status = await crew_manager.get_crew_status(crew_id)
        return status
    
    except Exception as e:
        logger.error(f"Error getting crew status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crew/templates")
async def get_crew_templates():
    """Get available agent templates"""
    if not crew_manager:
        raise HTTPException(status_code=503, detail="CrewAI manager not available")
    
    try:
        templates = await crew_manager.get_available_templates()
        return templates
    
    except Exception as e:
        logger.error(f"Error getting crew templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Memory endpoints
@app.post("/api/memory/store")
async def store_memory(request: MemoryStoreRequest):
    """Store a memory"""
    if not memory_system:
        raise HTTPException(status_code=503, detail="Memory system not available")
    
    try:
        memory_id = await memory_system.store_memory(
            text=request.text,
            metadata=request.metadata,
            user_id=request.user_id,
            memory_type=request.memory_type
        )
        
        return {"memory_id": memory_id}
    
    except Exception as e:
        logger.error(f"Error storing memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/memory/retrieve")
async def retrieve_memories(request: MemoryRetrieveRequest):
    """Retrieve memories"""
    if not memory_system:
        raise HTTPException(status_code=503, detail="Memory system not available")
    
    try:
        memories = await memory_system.retrieve_memories(
            query=request.query,
            user_id=request.user_id,
            memory_type=request.memory_type,
            limit=request.limit
        )
        
        return {"memories": memories}
    
    except Exception as e:
        logger.error(f"Error retrieving memories: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/memory/conversation/{conversation_id}")
async def get_conversation_history(conversation_id: str, limit: Optional[int] = None):
    """Get conversation history"""
    if not memory_system:
        raise HTTPException(status_code=503, detail="Memory system not available")
    
    try:
        history = await memory_system.get_conversation_history(
            conversation_id=conversation_id,
            limit=limit
        )
        
        return {"history": history}
    
    except Exception as e:
        logger.error(f"Error getting conversation history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time chat
@app.websocket("/ws/chat/{client_id}")
async def websocket_chat(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time chat"""
    await websocket.accept()
    websocket_connections[client_id] = websocket
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            request_data = json.loads(data)
            
            # Process request
            if not model_router:
                await websocket.send_json({"error": "Model router not available"})
                continue
            
            try:
                # Create model request
                model_request = ModelRequest(
                    prompt=request_data.get("prompt", ""),
                    task_type=TaskType(request_data.get("task_type", "chat")),
                    max_tokens=request_data.get("max_tokens", 1024),
                    temperature=request_data.get("temperature", 0.7),
                    top_p=request_data.get("top_p", 0.9),
                    stream=True,  # Always stream for WebSocket
                    system_prompt=request_data.get("system_prompt"),
                    user_id=request_data.get("user_id")
                )
                
                # Route the request
                response = await model_router.route_request(model_request)
                
                # Send response
                await websocket.send_json(response.dict())
                
                # Store in memory if conversation_id provided
                if memory_system and "conversation_id" in request_data:
                    await memory_system.store_conversation(
                        conversation_id=request_data["conversation_id"],
                        user_message=request_data.get("prompt", ""),
                        assistant_message=response.text,
                        metadata={
                            "model_used": response.model_used,
                            "provider": response.provider,
                            "tokens_used": response.tokens_used,
                            "cost": response.cost
                        }
                    )
            
            except Exception as e:
                logger.error(f"Error processing WebSocket request: {str(e)}")
                await websocket.send_json({"error": str(e)})
    
    except WebSocketDisconnect:
        if client_id in websocket_connections:
            del websocket_connections[client_id]
    
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        if client_id in websocket_connections:
            del websocket_connections[client_id]

# Serve static files
app.mount("/static", StaticFiles(directory="/app/static"), name="static")

# Main entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

