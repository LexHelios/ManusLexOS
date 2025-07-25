import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import apiClient from '@/lib/api';

export interface Agent {
  id: string;
  name: string;
  role: string;
  goal: string;
  template: string;
  model: string;
  tools: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Crew {
  id: string;
  name: string;
  agents: string[]; // Agent IDs
  tasks: Task[];
  processType: 'sequential' | 'hierarchical';
  status: 'idle' | 'running' | 'completed' | 'failed';
  result?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  duration?: number;
}

export interface Task {
  id: string;
  description: string;
  agentId: string;
  expectedOutput: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  createdAt: number;
  updatedAt: number;
}

interface AgentState {
  agents: Agent[];
  crews: Crew[];
  availableTemplates: string[];
  availableTools: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateAgent: (id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteAgent: (id: string) => void;
  
  createCrew: (crew: Omit<Crew, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<string>;
  updateCrew: (id: string, updates: Partial<Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteCrew: (id: string) => void;
  runCrew: (id: string) => Promise<void>;
  
  fetchTemplates: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      crews: [],
      availableTemplates: [],
      availableTools: [],
      isLoading: false,
      error: null,

      createAgent: (agentData) => {
        const id = uuidv4();
        const agent: Agent = {
          ...agentData,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          agents: [...state.agents, agent],
        }));

        return id;
      },

      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === id
              ? { ...agent, ...updates, updatedAt: Date.now() }
              : agent
          ),
        }));
      },

      deleteAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((agent) => agent.id !== id),
        }));
      },

      createCrew: async (crewData) => {
        try {
          set({ isLoading: true, error: null });
          
          const id = uuidv4();
          const crew: Crew = {
            ...crewData,
            id,
            status: 'idle',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          // Create the crew in the API
          const apiCrewData = {
            crew_name: crew.name,
            agent_templates: crew.agents.map(agentId => {
              const agent = get().agents.find(a => a.id === agentId);
              return agent?.template || 'researcher';
            }),
            tasks: crew.tasks.map(task => ({
              description: task.description,
              agent_index: crew.agents.findIndex(agentId => agentId === task.agentId),
              expected_output: task.expectedOutput,
            })),
            process_type: crew.processType,
          };

          const response = await apiClient.crew.create(apiCrewData);
          
          // Store the API crew ID in our crew object
          const apiCrewId = response.data.crew_id;
          crew.id = apiCrewId;

          set((state) => ({
            crews: [...state.crews, crew],
            isLoading: false,
          }));

          return apiCrewId;
        } catch (error) {
          console.error('Failed to create crew:', error);
          set({ 
            error: 'Failed to create crew', 
            isLoading: false 
          });
          throw error;
        }
      },

      updateCrew: (id, updates) => {
        set((state) => ({
          crews: state.crews.map((crew) =>
            crew.id === id
              ? { ...crew, ...updates, updatedAt: Date.now() }
              : crew
          ),
        }));
      },

      deleteCrew: (id) => {
        set((state) => ({
          crews: state.crews.filter((crew) => crew.id !== id),
        }));
      },

      runCrew: async (id) => {
        try {
          set({ isLoading: true, error: null });
          
          // Update crew status to running
          set((state) => ({
            crews: state.crews.map((crew) =>
              crew.id === id
                ? { ...crew, status: 'running', updatedAt: Date.now() }
                : crew
            ),
          }));

          // Run the crew in the API
          const response = await apiClient.crew.run(id);
          
          // Update crew with results
          set((state) => ({
            crews: state.crews.map((crew) =>
              crew.id === id
                ? { 
                    ...crew, 
                    status: 'completed', 
                    result: response.data.result,
                    completedAt: Date.now(),
                    duration: response.data.duration,
                    updatedAt: Date.now() 
                  }
                : crew
            ),
            isLoading: false,
          }));
        } catch (error) {
          console.error('Failed to run crew:', error);
          
          // Update crew status to failed
          set((state) => ({
            crews: state.crews.map((crew) =>
              crew.id === id
                ? { ...crew, status: 'failed', updatedAt: Date.now() }
                : crew
            ),
            error: 'Failed to run crew',
            isLoading: false,
          }));
        }
      },

      fetchTemplates: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiClient.crew.getTemplates();
          
          set({ 
            availableTemplates: response.data.agent_templates,
            availableTools: response.data.tools,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to fetch templates:', error);
          set({ 
            error: 'Failed to fetch agent templates', 
            isLoading: false 
          });
        }
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'lexos-agent-store',
    }
  )
);

export default useAgentStore;

