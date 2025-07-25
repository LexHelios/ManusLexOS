import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  PlusIcon, 
  TrashIcon,
  PlayIcon,
  PauseIcon,
  UserGroupIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import useAgentStore, { Agent, Crew, Task } from '@/store/agentStore';
import { cn, timeAgo } from '@/lib/utils';

const AgentManager: React.FC = () => {
  const { 
    agents, 
    crews, 
    createAgent, 
    updateAgent, 
    deleteAgent,
    createCrew,
    runCrew,
    fetchTemplates,
    availableTemplates,
    availableTools,
    isLoading,
  } = useAgentStore();
  
  const [activeTab, setActiveTab] = useState<'agents' | 'crews'>('agents');
  const [showNewAgentForm, setShowNewAgentForm] = useState(false);
  const [showNewCrewForm, setShowNewCrewForm] = useState(false);
  
  // New agent form state
  const [newAgent, setNewAgent] = useState<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    role: '',
    goal: '',
    template: 'researcher',
    model: 'qwen2.5-72b',
    tools: [],
  });
  
  // New crew form state
  const [newCrew, setNewCrew] = useState<{
    name: string;
    agents: string[];
    tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'result'>[];
    processType: 'sequential' | 'hierarchical';
  }>({
    name: '',
    agents: [],
    tasks: [],
    processType: 'sequential',
  });
  
  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);
  
  // Handle creating a new agent
  const handleCreateAgent = () => {
    if (newAgent.name && newAgent.role && newAgent.goal) {
      createAgent(newAgent);
      setNewAgent({
        name: '',
        role: '',
        goal: '',
        template: 'researcher',
        model: 'qwen2.5-72b',
        tools: [],
      });
      setShowNewAgentForm(false);
    }
  };
  
  // Handle creating a new crew
  const handleCreateCrew = async () => {
    if (newCrew.name && newCrew.agents.length > 0 && newCrew.tasks.length > 0) {
      try {
        await createCrew({
          name: newCrew.name,
          agents: newCrew.agents,
          tasks: newCrew.tasks.map(task => ({
            ...task,
            id: '',
            status: 'pending',
            createdAt: 0,
            updatedAt: 0,
          })),
          processType: newCrew.processType,
        });
        
        setNewCrew({
          name: '',
          agents: [],
          tasks: [],
          processType: 'sequential',
        });
        setShowNewCrewForm(false);
      } catch (error) {
        console.error('Failed to create crew:', error);
      }
    }
  };
  
  // Handle adding a task to the new crew
  const handleAddTask = () => {
    if (newCrew.agents.length === 0) {
      alert('Please select at least one agent first');
      return;
    }
    
    setNewCrew(prev => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          description: '',
          agentId: prev.agents[0],
          expectedOutput: 'Comprehensive analysis',
        }
      ]
    }));
  };
  
  // Handle updating a task
  const handleUpdateTask = (index: number, field: keyof Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'result'>, value: string) => {
    setNewCrew(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };
  
  // Handle removing a task
  const handleRemoveTask = (index: number) => {
    setNewCrew(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };
  
  // Handle running a crew
  const handleRunCrew = (crewId: string) => {
    runCrew(crewId);
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border">
        <div className="flex">
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium",
              activeTab === 'agents' 
                ? "border-b-2 border-primary text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab('agents')}
          >
            Agents
          </button>
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium",
              activeTab === 'crews' 
                ? "border-b-2 border-primary text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab('crews')}
          >
            Crews
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'agents' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Your Agents</h2>
              <Button 
                onClick={() => setShowNewAgentForm(!showNewAgentForm)}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                {showNewAgentForm ? (
                  <>
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    <span>New Agent</span>
                  </>
                )}
              </Button>
            </div>
            
            {showNewAgentForm && (
              <div className="bg-card p-4 rounded-lg border border-border mb-4">
                <h3 className="text-md font-medium mb-3">Create New Agent</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Name</label>
                    <Input
                      value={newAgent.name}
                      onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                      placeholder="Agent name"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Role</label>
                    <Input
                      value={newAgent.role}
                      onChange={(e) => setNewAgent({...newAgent, role: e.target.value})}
                      placeholder="e.g., Research Specialist"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Goal</label>
                    <Input
                      value={newAgent.goal}
                      onChange={(e) => setNewAgent({...newAgent, goal: e.target.value})}
                      placeholder="e.g., Find accurate information"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Template</label>
                    <select
                      value={newAgent.template}
                      onChange={(e) => setNewAgent({...newAgent, template: e.target.value})}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {availableTemplates.map((template) => (
                        <option key={template} value={template}>
                          {template}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Model</label>
                    <select
                      value={newAgent.model}
                      onChange={(e) => setNewAgent({...newAgent, model: e.target.value})}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="qwen2.5-72b">Qwen 2.5 (72B)</option>
                      <option value="deepseek-r1">DeepSeek R1</option>
                      <option value="llama-3.1-70b">Llama 3.1 (70B)</option>
                      <option value="codellama-34b">CodeLlama (34B)</option>
                      <option value="mixtral-8x22b">Mixtral (8x22B)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Tools</label>
                    <div className="space-y-1">
                      {availableTools.map((tool) => (
                        <label key={tool} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newAgent.tools.includes(tool)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewAgent({...newAgent, tools: [...newAgent.tools, tool]});
                              } else {
                                setNewAgent({
                                  ...newAgent, 
                                  tools: newAgent.tools.filter(t => t !== tool)
                                });
                              }
                            }}
                            className="mr-2"
                          />
                          {tool}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button onClick={handleCreateAgent} disabled={isLoading}>
                      Create Agent
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div 
                  key={agent.id} 
                  className="bg-card p-4 rounded-lg border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <UserIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground">{agent.role}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteAgent(agent.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-sm"><span className="font-medium">Goal:</span> {agent.goal}</p>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="bg-secondary/50 px-2 py-1 rounded text-xs">
                      {agent.template}
                    </span>
                    <span className="bg-secondary/50 px-2 py-1 rounded text-xs">
                      {agent.model}
                    </span>
                    {agent.tools.map((tool) => (
                      <span 
                        key={tool} 
                        className="bg-secondary/50 px-2 py-1 rounded text-xs"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              
              {agents.length === 0 && !showNewAgentForm && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No agents created yet. Click "New Agent" to create one.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Your Crews</h2>
              <Button 
                onClick={() => setShowNewCrewForm(!showNewCrewForm)}
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={agents.length === 0}
              >
                {showNewCrewForm ? (
                  <>
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    <span>New Crew</span>
                  </>
                )}
              </Button>
            </div>
            
            {agents.length === 0 && (
              <div className="bg-muted/30 p-4 rounded-lg mb-4 text-center">
                <p>You need to create agents before you can form a crew.</p>
                <Button 
                  onClick={() => setActiveTab('agents')}
                  variant="link"
                  className="mt-2"
                >
                  Go to Agents
                </Button>
              </div>
            )}
            
            {showNewCrewForm && agents.length > 0 && (
              <div className="bg-card p-4 rounded-lg border border-border mb-4">
                <h3 className="text-md font-medium mb-3">Create New Crew</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Name</label>
                    <Input
                      value={newCrew.name}
                      onChange={(e) => setNewCrew({...newCrew, name: e.target.value})}
                      placeholder="Crew name"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Select Agents</label>
                    <div className="space-y-1">
                      {agents.map((agent) => (
                        <label key={agent.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newCrew.agents.includes(agent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCrew({...newCrew, agents: [...newCrew.agents, agent.id]});
                              } else {
                                setNewCrew({
                                  ...newCrew, 
                                  agents: newCrew.agents.filter(id => id !== agent.id)
                                });
                              }
                            }}
                            className="mr-2"
                          />
                          {agent.name} ({agent.role})
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-1">Process Type</label>
                    <select
                      value={newCrew.processType}
                      onChange={(e) => setNewCrew({
                        ...newCrew, 
                        processType: e.target.value as 'sequential' | 'hierarchical'
                      })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="sequential">Sequential</option>
                      <option value="hierarchical">Hierarchical</option>
                    </select>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium">Tasks</label>
                      <Button 
                        onClick={handleAddTask}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1"
                      >
                        <PlusIcon className="h-3 w-3" />
                        <span>Add Task</span>
                      </Button>
                    </div>
                    
                    {newCrew.tasks.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-md">
                        No tasks added yet. Click "Add Task" to create one.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {newCrew.tasks.map((task, index) => (
                          <div key={index} className="border border-border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-sm font-medium">Task {index + 1}</span>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRemoveTask(index)}
                              >
                                <TrashIcon className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs block mb-1">Description</label>
                                <Textarea
                                  value={task.description}
                                  onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                                  placeholder="Task description"
                                  className="min-h-[60px]"
                                />
                              </div>
                              
                              <div>
                                <label className="text-xs block mb-1">Assign to Agent</label>
                                <select
                                  value={task.agentId}
                                  onChange={(e) => handleUpdateTask(index, 'agentId', e.target.value)}
                                  className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                >
                                  {newCrew.agents.map((agentId) => {
                                    const agent = agents.find(a => a.id === agentId);
                                    return (
                                      <option key={agentId} value={agentId}>
                                        {agent ? agent.name : 'Unknown Agent'}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              
                              <div>
                                <label className="text-xs block mb-1">Expected Output</label>
                                <Input
                                  value={task.expectedOutput}
                                  onChange={(e) => handleUpdateTask(index, 'expectedOutput', e.target.value)}
                                  placeholder="e.g., Comprehensive analysis"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      onClick={handleCreateCrew} 
                      disabled={
                        isLoading || 
                        !newCrew.name || 
                        newCrew.agents.length === 0 || 
                        newCrew.tasks.length === 0
                      }
                    >
                      Create Crew
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {crews.map((crew) => (
                <div 
                  key={crew.id} 
                  className="bg-card p-4 rounded-lg border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <UserGroupIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{crew.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {crew.agents.length} agents · {crew.tasks.length} tasks
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span 
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          crew.status === 'idle' && "bg-secondary text-secondary-foreground",
                          crew.status === 'running' && "bg-blue-500/20 text-blue-500",
                          crew.status === 'completed' && "bg-green-500/20 text-green-500",
                          crew.status === 'failed' && "bg-red-500/20 text-red-500"
                        )}
                      >
                        {crew.status}
                      </span>
                      
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRunCrew(crew.id)}
                        disabled={crew.status === 'running' || isLoading}
                      >
                        {crew.status === 'running' ? (
                          <PauseIcon className="h-4 w-4" />
                        ) : (
                          <PlayIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {crew.result && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-md">
                      <p className="text-sm font-medium mb-1">Result:</p>
                      <p className="text-sm">{crew.result}</p>
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">
                      Created {timeAgo(crew.createdAt)}
                      {crew.completedAt && ` · Completed ${timeAgo(crew.completedAt)}`}
                      {crew.duration && ` · Took ${(crew.duration / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                </div>
              ))}
              
              {crews.length === 0 && !showNewCrewForm && agents.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No crews created yet. Click "New Crew" to create one.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentManager;

