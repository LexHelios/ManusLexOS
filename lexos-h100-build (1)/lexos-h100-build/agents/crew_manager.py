"""
CrewAI Agent Manager

This module provides a manager for CrewAI agents, allowing for multi-agent
collaboration and task delegation.
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
import time
from loguru import logger

# Import CrewAI
try:
    from crewai import Agent, Task, Crew, Process
    from crewai.tools import BaseTool
    CREWAI_AVAILABLE = True
except ImportError:
    logger.warning("CrewAI not available, multi-agent features will be limited")
    CREWAI_AVAILABLE = False

# Import LangChain for tools
try:
    from langchain.tools import BaseTool as LangChainTool
    LANGCHAIN_AVAILABLE = True
except ImportError:
    logger.warning("LangChain not available, tool usage will be limited")
    LANGCHAIN_AVAILABLE = False

# Import model managers
from models.h100_manager import H100ModelManager
from models.together_client import TogetherClient

class CrewAIManager:
    """Manager for CrewAI agents"""
    
    def __init__(
        self,
        h100_manager: Optional[H100ModelManager] = None,
        together_client: Optional[TogetherClient] = None
    ):
        """Initialize the CrewAI manager"""
        self.h100_manager = h100_manager
        self.together_client = together_client
        
        # Check if CrewAI is available
        self.available = CREWAI_AVAILABLE
        
        # Initialize tools
        self.tools = self._initialize_tools()
        
        # Initialize agent templates
        self.agent_templates = self._initialize_agent_templates()
        
        # Initialize active crews
        self.active_crews = {}
        
        logger.info(f"CrewAI manager initialized (available: {self.available})")
    
    def _initialize_tools(self) -> Dict[str, Any]:
        """Initialize available tools"""
        tools = {}
        
        if not CREWAI_AVAILABLE or not LANGCHAIN_AVAILABLE:
            return tools
        
        # Define basic tools
        
        # Web search tool
        class WebSearchTool(BaseTool):
            name = "web_search"
            description = "Search the web for information"
            
            def _run(self, query: str) -> str:
                # This would use a real search API
                return f"Search results for: {query}"
        
        # Calculator tool
        class CalculatorTool(BaseTool):
            name = "calculator"
            description = "Perform mathematical calculations"
            
            def _run(self, expression: str) -> str:
                try:
                    return str(eval(expression))
                except Exception as e:
                    return f"Error: {str(e)}"
        
        # Document reader tool
        class DocumentReaderTool(BaseTool):
            name = "document_reader"
            description = "Read and extract information from documents"
            
            def _run(self, document_path: str) -> str:
                # This would use a real document reader
                return f"Content of document: {document_path}"
        
        # Add tools to dictionary
        tools["web_search"] = WebSearchTool()
        tools["calculator"] = CalculatorTool()
        tools["document_reader"] = DocumentReaderTool()
        
        return tools
    
    def _initialize_agent_templates(self) -> Dict[str, Dict]:
        """Initialize agent templates"""
        templates = {}
        
        if not CREWAI_AVAILABLE:
            return templates
        
        # Define agent templates
        templates["researcher"] = {
            "name": "Researcher",
            "role": "Research Specialist",
            "goal": "Find accurate and comprehensive information",
            "backstory": "You are an expert researcher with a talent for finding and synthesizing information from various sources.",
            "tools": ["web_search", "document_reader"],
            "default_model": "qwen2.5-72b"
        }
        
        templates["analyst"] = {
            "name": "Analyst",
            "role": "Data Analyst",
            "goal": "Analyze information and extract insights",
            "backstory": "You are a skilled analyst who can process complex data and identify patterns and insights.",
            "tools": ["calculator", "document_reader"],
            "default_model": "deepseek-r1"
        }
        
        templates["writer"] = {
            "name": "Writer",
            "role": "Content Creator",
            "goal": "Create engaging and informative content",
            "backstory": "You are a talented writer who can create compelling content on any topic.",
            "tools": ["document_reader"],
            "default_model": "llama-3.1-70b"
        }
        
        templates["coder"] = {
            "name": "Coder",
            "role": "Software Developer",
            "goal": "Write efficient and effective code",
            "backstory": "You are an experienced software developer who can write code in multiple languages.",
            "tools": ["calculator"],
            "default_model": "codellama-34b"
        }
        
        templates["planner"] = {
            "name": "Planner",
            "role": "Strategic Planner",
            "goal": "Create effective plans and strategies",
            "backstory": "You are a strategic thinker who can develop comprehensive plans for complex projects.",
            "tools": ["calculator", "document_reader"],
            "default_model": "mixtral-8x22b"
        }
        
        return templates
    
    def _create_agent(
        self,
        template_name: str,
        agent_id: Optional[str] = None,
        override_model: Optional[str] = None,
        override_tools: Optional[List[str]] = None
    ) -> Any:
        """Create an agent from a template"""
        if not CREWAI_AVAILABLE:
            raise ValueError("CrewAI is not available")
        
        # Get template
        if template_name not in self.agent_templates:
            raise ValueError(f"Agent template {template_name} not found")
        
        template = self.agent_templates[template_name]
        
        # Determine model to use
        model_name = override_model or template["default_model"]
        
        # Create LLM
        if self.together_client and model_name in ["qwen2.5-72b", "deepseek-r1", "llama-3.1-70b", "codellama-34b", "mixtral-8x22b"]:
            # Use Together API
            from langchain_together import Together
            llm = Together(
                model=f"together/{model_name}",
                temperature=0.7,
                together_api_key=os.environ.get("TOGETHER_API_KEY")
            )
        else:
            # Use local model
            from langchain_community.llms import HuggingFacePipeline
            # This is a placeholder - in production we'd use the actual H100 models
            llm = HuggingFacePipeline(pipeline="text-generation")
        
        # Get tools
        agent_tools = []
        tool_names = override_tools or template["tools"]
        for tool_name in tool_names:
            if tool_name in self.tools:
                agent_tools.append(self.tools[tool_name])
        
        # Create agent
        agent = Agent(
            role=template["role"],
            goal=template["goal"],
            backstory=template["backstory"],
            tools=agent_tools,
            llm=llm,
            verbose=True
        )
        
        return agent
    
    async def create_crew(
        self,
        crew_name: str,
        agent_templates: List[str],
        tasks: List[Dict],
        process_type: str = "sequential"
    ) -> str:
        """Create a crew of agents"""
        if not CREWAI_AVAILABLE:
            raise ValueError("CrewAI is not available")
        
        # Generate crew ID
        import uuid
        crew_id = str(uuid.uuid4())
        
        # Create agents
        agents = []
        for template_name in agent_templates:
            agent = self._create_agent(template_name)
            agents.append(agent)
        
        # Create tasks
        crew_tasks = []
        for task_info in tasks:
            # Find the agent for this task
            agent_index = task_info.get("agent_index", 0)
            if agent_index >= len(agents):
                agent_index = 0
            
            task = Task(
                description=task_info["description"],
                agent=agents[agent_index],
                expected_output=task_info.get("expected_output", "Comprehensive analysis")
            )
            crew_tasks.append(task)
        
        # Determine process type
        if process_type == "sequential":
            process = Process.sequential
        elif process_type == "hierarchical":
            process = Process.hierarchical
        else:
            process = Process.sequential
        
        # Create crew
        crew = Crew(
            agents=agents,
            tasks=crew_tasks,
            process=process,
            verbose=True
        )
        
        # Store crew
        self.active_crews[crew_id] = {
            "name": crew_name,
            "crew": crew,
            "agents": agents,
            "tasks": crew_tasks,
            "created_at": time.time()
        }
        
        return crew_id
    
    async def run_crew(self, crew_id: str) -> Dict:
        """Run a crew's tasks"""
        if not CREWAI_AVAILABLE:
            raise ValueError("CrewAI is not available")
        
        if crew_id not in self.active_crews:
            raise ValueError(f"Crew {crew_id} not found")
        
        crew_info = self.active_crews[crew_id]
        crew = crew_info["crew"]
        
        # Run the crew
        start_time = time.time()
        result = crew.kickoff()
        end_time = time.time()
        
        # Store result
        crew_info["result"] = result
        crew_info["completed_at"] = end_time
        crew_info["duration"] = end_time - start_time
        
        return {
            "crew_id": crew_id,
            "result": result,
            "duration": end_time - start_time
        }
    
    async def get_crew_status(self, crew_id: str) -> Dict:
        """Get the status of a crew"""
        if crew_id not in self.active_crews:
            raise ValueError(f"Crew {crew_id} not found")
        
        crew_info = self.active_crews[crew_id]
        
        return {
            "crew_id": crew_id,
            "name": crew_info["name"],
            "created_at": crew_info["created_at"],
            "completed_at": crew_info.get("completed_at"),
            "duration": crew_info.get("duration"),
            "has_result": "result" in crew_info,
            "agent_count": len(crew_info["agents"]),
            "task_count": len(crew_info["tasks"])
        }
    
    async def get_available_templates(self) -> Dict:
        """Get available agent templates"""
        return {
            "agent_templates": list(self.agent_templates.keys()),
            "tools": list(self.tools.keys())
        }

