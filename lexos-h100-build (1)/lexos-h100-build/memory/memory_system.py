"""
LexOS Memory System

This module provides a comprehensive memory system for LexOS, including:
- Short-term conversation memory
- Long-term semantic memory using Qdrant
- File library for document storage and retrieval
- User preferences and personalization
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
import time
from datetime import datetime
from loguru import logger
from pathlib import Path
import uuid

# Import for vector database
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qdrant_models
    from qdrant_client.http.models import Distance, VectorParams
    QDRANT_AVAILABLE = True
except ImportError:
    logger.warning("Qdrant client not available, falling back to in-memory storage")
    QDRANT_AVAILABLE = False

# Import for embeddings
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    logger.warning("Sentence Transformers not available, using mock embeddings")
    SENTENCE_TRANSFORMERS_AVAILABLE = False

class MemorySystem:
    """Comprehensive memory system for LexOS"""
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the memory system"""
        self.config = config or {}
        
        # Initialize memory backends
        self.memory_backend = os.environ.get("MEMORY_BACKEND", "qdrant")
        
        # Initialize embedding model
        self.embedding_model = self._initialize_embedding_model()
        
        # Initialize vector database
        self.vector_db = self._initialize_vector_db()
        
        # Initialize conversation memory
        self.conversations = {}
        
        # Initialize file library
        self.file_library = {}
        
        # Initialize user preferences
        self.user_preferences = {}
        
        logger.info(f"Memory system initialized with backend: {self.memory_backend}")
    
    def _initialize_embedding_model(self):
        """Initialize the embedding model"""
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                # Use a small, efficient model for embeddings
                model_name = "all-MiniLM-L6-v2"
                return SentenceTransformer(model_name)
            except Exception as e:
                logger.error(f"Error loading embedding model: {str(e)}")
                return None
        else:
            return None
    
    def _initialize_vector_db(self):
        """Initialize the vector database"""
        if self.memory_backend == "qdrant" and QDRANT_AVAILABLE:
            try:
                # Connect to Qdrant
                qdrant_host = os.environ.get("QDRANT_HOST", "localhost")
                qdrant_port = int(os.environ.get("QDRANT_PORT", "6333"))
                
                client = QdrantClient(host=qdrant_host, port=qdrant_port)
                
                # Create collections if they don't exist
                self._create_collections(client)
                
                return client
            except Exception as e:
                logger.error(f"Error connecting to Qdrant: {str(e)}")
                return None
        else:
            # Fallback to in-memory storage
            return {}
    
    def _create_collections(self, client):
        """Create necessary collections in Qdrant"""
        if not QDRANT_AVAILABLE:
            return
        
        # Define collections
        collections = {
            "memories": {
                "size": 384,  # Embedding size for all-MiniLM-L6-v2
                "distance": Distance.COSINE
            },
            "documents": {
                "size": 384,
                "distance": Distance.COSINE
            },
            "conversations": {
                "size": 384,
                "distance": Distance.COSINE
            }
        }
        
        # Create each collection if it doesn't exist
        for name, params in collections.items():
            try:
                # Check if collection exists
                try:
                    client.get_collection(name)
                    logger.info(f"Collection {name} already exists")
                except Exception:
                    # Create collection
                    client.create_collection(
                        collection_name=name,
                        vectors_config=VectorParams(
                            size=params["size"],
                            distance=params["distance"]
                        )
                    )
                    logger.info(f"Created collection {name}")
            except Exception as e:
                logger.error(f"Error creating collection {name}: {str(e)}")
    
    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for a text"""
        if self.embedding_model:
            return self.embedding_model.encode(text).tolist()
        else:
            # Mock embedding for testing
            import random
            return [random.random() for _ in range(384)]
    
    async def store_memory(
        self,
        text: str,
        metadata: Optional[Dict] = None,
        user_id: Optional[str] = None,
        memory_type: str = "general"
    ) -> str:
        """Store a memory in the long-term memory system"""
        metadata = metadata or {}
        metadata["timestamp"] = datetime.now().isoformat()
        metadata["type"] = memory_type
        metadata["user_id"] = user_id
        
        # Generate a unique ID
        memory_id = str(uuid.uuid4())
        
        # Get embedding
        embedding = self._get_embedding(text)
        
        # Store in vector database
        if self.memory_backend == "qdrant" and self.vector_db:
            try:
                self.vector_db.upsert(
                    collection_name="memories",
                    points=[
                        qdrant_models.PointStruct(
                            id=memory_id,
                            vector=embedding,
                            payload={
                                "text": text,
                                **metadata
                            }
                        )
                    ]
                )
            except Exception as e:
                logger.error(f"Error storing memory in Qdrant: {str(e)}")
                # Fallback to in-memory
                if "memories" not in self.vector_db:
                    self.vector_db["memories"] = {}
                self.vector_db["memories"][memory_id] = {
                    "text": text,
                    "embedding": embedding,
                    "metadata": metadata
                }
        else:
            # Store in-memory
            if "memories" not in self.vector_db:
                self.vector_db["memories"] = {}
            self.vector_db["memories"][memory_id] = {
                "text": text,
                "embedding": embedding,
                "metadata": metadata
            }
        
        return memory_id
    
    async def retrieve_memories(
        self,
        query: str,
        user_id: Optional[str] = None,
        memory_type: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict]:
        """Retrieve memories similar to the query"""
        # Get embedding for query
        query_embedding = self._get_embedding(query)
        
        # Search in vector database
        if self.memory_backend == "qdrant" and self.vector_db and QDRANT_AVAILABLE:
            try:
                # Build filter
                filter_query = None
                if user_id or memory_type:
                    must_conditions = []
                    if user_id:
                        must_conditions.append(
                            qdrant_models.FieldCondition(
                                key="user_id",
                                match=qdrant_models.MatchValue(value=user_id)
                            )
                        )
                    if memory_type:
                        must_conditions.append(
                            qdrant_models.FieldCondition(
                                key="type",
                                match=qdrant_models.MatchValue(value=memory_type)
                            )
                        )
                    filter_query = qdrant_models.Filter(must=must_conditions)
                
                # Search
                results = self.vector_db.search(
                    collection_name="memories",
                    query_vector=query_embedding,
                    limit=limit,
                    query_filter=filter_query
                )
                
                # Format results
                memories = []
                for result in results:
                    memories.append({
                        "id": result.id,
                        "text": result.payload["text"],
                        "similarity": result.score,
                        "metadata": {k: v for k, v in result.payload.items() if k != "text"}
                    })
                
                return memories
            except Exception as e:
                logger.error(f"Error retrieving memories from Qdrant: {str(e)}")
                # Fallback to in-memory
        
        # In-memory search
        if "memories" not in self.vector_db:
            return []
        
        # Simple vector similarity search
        from numpy import dot
        from numpy.linalg import norm
        
        def cosine_similarity(a, b):
            return dot(a, b) / (norm(a) * norm(b))
        
        results = []
        for memory_id, memory in self.vector_db["memories"].items():
            # Apply filters
            if user_id and memory["metadata"].get("user_id") != user_id:
                continue
            if memory_type and memory["metadata"].get("type") != memory_type:
                continue
            
            # Calculate similarity
            similarity = cosine_similarity(query_embedding, memory["embedding"])
            
            results.append({
                "id": memory_id,
                "text": memory["text"],
                "similarity": similarity,
                "metadata": memory["metadata"]
            })
        
        # Sort by similarity and limit
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:limit]
    
    async def store_conversation(
        self,
        conversation_id: str,
        user_message: str,
        assistant_message: str,
        metadata: Optional[Dict] = None
    ):
        """Store a conversation turn in memory"""
        metadata = metadata or {}
        metadata["timestamp"] = datetime.now().isoformat()
        
        # Create conversation if it doesn't exist
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []
        
        # Add the turn
        self.conversations[conversation_id].append({
            "user": user_message,
            "assistant": assistant_message,
            "metadata": metadata
        })
        
        # Store in long-term memory
        combined_text = f"User: {user_message}\nAssistant: {assistant_message}"
        await self.store_memory(
            text=combined_text,
            metadata={
                "conversation_id": conversation_id,
                **metadata
            },
            memory_type="conversation"
        )
    
    async def get_conversation_history(
        self,
        conversation_id: str,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """Get conversation history"""
        if conversation_id not in self.conversations:
            return []
        
        history = self.conversations[conversation_id]
        if limit:
            return history[-limit:]
        return history
    
    async def store_file(
        self,
        file_path: str,
        content_type: str,
        metadata: Optional[Dict] = None,
        user_id: Optional[str] = None,
        extract_text: bool = True
    ) -> str:
        """Store a file in the file library"""
        metadata = metadata or {}
        metadata["timestamp"] = datetime.now().isoformat()
        metadata["content_type"] = content_type
        metadata["user_id"] = user_id
        
        # Generate a unique ID
        file_id = str(uuid.uuid4())
        
        # Extract text if requested
        text_content = None
        if extract_text:
            # This would use appropriate extractors based on content type
            # For now, we'll just use a placeholder
            text_content = f"Text extracted from {file_path}"
        
        # Store file info
        self.file_library[file_id] = {
            "path": file_path,
            "content_type": content_type,
            "metadata": metadata,
            "text_content": text_content
        }
        
        # If text was extracted, store in vector database
        if text_content:
            await self.store_memory(
                text=text_content,
                metadata={
                    "file_id": file_id,
                    "file_path": file_path,
                    **metadata
                },
                user_id=user_id,
                memory_type="document"
            )
        
        return file_id
    
    async def retrieve_file(self, file_id: str) -> Optional[Dict]:
        """Retrieve a file from the file library"""
        return self.file_library.get(file_id)
    
    async def search_files(
        self,
        query: str,
        user_id: Optional[str] = None,
        content_type: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict]:
        """Search for files based on their content"""
        # Get embedding for query
        query_embedding = self._get_embedding(query)
        
        # Search in vector database for documents
        memories = await self.retrieve_memories(
            query=query,
            user_id=user_id,
            memory_type="document",
            limit=limit
        )
        
        # Extract file IDs
        file_ids = [memory["metadata"].get("file_id") for memory in memories if "file_id" in memory["metadata"]]
        
        # Get file details
        results = []
        for file_id in file_ids:
            file_info = await self.retrieve_file(file_id)
            if file_info:
                # Apply content type filter
                if content_type and file_info["content_type"] != content_type:
                    continue
                
                results.append({
                    "id": file_id,
                    "path": file_info["path"],
                    "content_type": file_info["content_type"],
                    "metadata": file_info["metadata"]
                })
        
        return results
    
    async def store_user_preference(
        self,
        user_id: str,
        preference_key: str,
        preference_value: Any
    ):
        """Store a user preference"""
        if user_id not in self.user_preferences:
            self.user_preferences[user_id] = {}
        
        self.user_preferences[user_id][preference_key] = preference_value
    
    async def get_user_preference(
        self,
        user_id: str,
        preference_key: str,
        default_value: Any = None
    ) -> Any:
        """Get a user preference"""
        if user_id not in self.user_preferences:
            return default_value
        
        return self.user_preferences[user_id].get(preference_key, default_value)
    
    async def get_all_user_preferences(self, user_id: str) -> Dict:
        """Get all preferences for a user"""
        return self.user_preferences.get(user_id, {})

