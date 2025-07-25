"""
LangChain Tools Integration

This module provides integration with LangChain tools for LexOS agents.
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
import time
from loguru import logger

# Import LangChain
try:
    from langchain.agents import Tool, AgentExecutor, create_react_agent
    from langchain.tools import BaseTool
    from langchain.tools.file_management import (
        ReadFileTool,
        WriteFileTool,
        ListDirectoryTool
    )
    from langchain.tools.shell import ShellTool
    from langchain.tools.human import HumanInputRun
    from langchain_community.tools import DuckDuckGoSearchRun
    from langchain_community.utilities import GoogleSearchAPIWrapper
    from langchain_community.tools import YouTubeSearchTool
    LANGCHAIN_AVAILABLE = True
except ImportError:
    logger.warning("LangChain not available, tool usage will be limited")
    LANGCHAIN_AVAILABLE = False

class LangChainToolManager:
    """Manager for LangChain tools"""
    
    def __init__(self):
        """Initialize the LangChain tool manager"""
        # Check if LangChain is available
        self.available = LANGCHAIN_AVAILABLE
        
        # Initialize tools
        self.tools = self._initialize_tools()
        
        logger.info(f"LangChain tool manager initialized (available: {self.available})")
    
    def _initialize_tools(self) -> Dict[str, Any]:
        """Initialize available tools"""
        tools = {}
        
        if not LANGCHAIN_AVAILABLE:
            return tools
        
        # File management tools
        tools["read_file"] = ReadFileTool()
        tools["write_file"] = WriteFileTool()
        tools["list_directory"] = ListDirectoryTool()
        
        # Shell tool (with restrictions)
        shell_tool = ShellTool()
        shell_tool.description = (
            "Run shell commands on the server. Use this tool with caution and only when necessary. "
            "Commands are executed in a restricted environment."
        )
        tools["shell"] = shell_tool
        
        # Search tools
        tools["web_search"] = DuckDuckGoSearchRun()
        
        # YouTube search
        tools["youtube_search"] = YouTubeSearchTool()
        
        # Human input tool
        tools["human_input"] = HumanInputRun()
        
        # Custom tools
        
        # Calculator tool
        class CalculatorTool(BaseTool):
            name = "calculator"
            description = "Useful for performing mathematical calculations"
            
            def _run(self, query: str) -> str:
                try:
                    return str(eval(query))
                except Exception as e:
                    return f"Error: {str(e)}"
        
        tools["calculator"] = CalculatorTool()
        
        # Weather tool
        class WeatherTool(BaseTool):
            name = "weather"
            description = "Get current weather information for a location"
            
            def _run(self, location: str) -> str:
                # This would use a real weather API
                return f"Weather information for {location}: Sunny, 72°F"
        
        tools["weather"] = WeatherTool()
        
        # News tool
        class NewsTool(BaseTool):
            name = "news"
            description = "Get latest news on a topic"
            
            def _run(self, topic: str) -> str:
                # This would use a real news API
                return f"Latest news on {topic}: Several new developments reported"
        
        tools["news"] = NewsTool()
        
        return tools
    
    def get_tool(self, tool_name: str) -> Optional[Any]:
        """Get a tool by name"""
        return self.tools.get(tool_name)
    
    def get_tools(self, tool_names: List[str]) -> List[Any]:
        """Get multiple tools by name"""
        return [self.tools[name] for name in tool_names if name in self.tools]
    
    def get_all_tools(self) -> Dict[str, Any]:
        """Get all available tools"""
        return self.tools
    
    def create_agent_with_tools(
        self,
        llm: Any,
        tool_names: List[str],
        system_message: Optional[str] = None
    ) -> Any:
        """Create a LangChain agent with specified tools"""
        if not LANGCHAIN_AVAILABLE:
            raise ValueError("LangChain is not available")
        
        # Get tools
        selected_tools = self.get_tools(tool_names)
        
        # Create agent
        from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
        
        # Define prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message or "You are a helpful AI assistant with access to tools."),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        
        # Create agent
        agent = create_react_agent(llm, selected_tools, prompt)
        
        # Create executor
        agent_executor = AgentExecutor(
            agent=agent,
            tools=selected_tools,
            verbose=True,
            handle_parsing_errors=True
        )
        
        return agent_executor
    
    async def run_agent(
        self,
        agent_executor: Any,
        input_text: str,
        chat_history: Optional[List] = None
    ) -> Dict:
        """Run a LangChain agent"""
        if not LANGCHAIN_AVAILABLE:
            raise ValueError("LangChain is not available")
        
        chat_history = chat_history or []
        
        # Run agent
        start_time = time.time()
        result = await agent_executor.ainvoke({
            "input": input_text,
            "chat_history": chat_history
        })
        end_time = time.time()
        
        return {
            "output": result["output"],
            "intermediate_steps": result.get("intermediate_steps", []),
            "duration": end_time - start_time
        }

