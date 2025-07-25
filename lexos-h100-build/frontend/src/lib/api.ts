import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Types
export interface ChatRequest {
  prompt: string;
  conversation_id?: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  user_id?: string;
  force_provider?: string;
  task_type?: string;
}

export interface ChatResponse {
  text: string;
  model_used: string;
  provider: string;
  tokens_used: number;
  cost: number;
  latency_ms: number;
  metadata?: Record<string, any>;
}

export interface ImageRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  user_id?: string;
}

export interface ImageResponse {
  text: string;
  image_path: string;
  model_used: string;
  provider: string;
  latency_ms: number;
}

export interface MemoryRequest {
  text: string;
  metadata?: Record<string, any>;
  user_id?: string;
  memory_type?: string;
}

export interface MemoryResponse {
  memory_id: string;
}

export interface MemoryQueryRequest {
  query: string;
  user_id?: string;
  memory_type?: string;
  limit?: number;
}

export interface Memory {
  id: string;
  text: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface MemoryQueryResponse {
  memories: Memory[];
}

export interface ConversationMessage {
  user: string;
  assistant: string;
  metadata: Record<string, any>;
}

export interface ConversationHistoryResponse {
  history: ConversationMessage[];
}

export interface CrewRequest {
  crew_name: string;
  agent_templates: string[];
  tasks: Record<string, any>[];
  process_type?: string;
  user_id?: string;
}

export interface CrewResponse {
  crew_id: string;
}

export interface CrewRunResponse {
  crew_id: string;
  result: string;
  duration: number;
}

export interface CrewStatusResponse {
  crew_id: string;
  name: string;
  created_at: number;
  completed_at?: number;
  duration?: number;
  has_result: boolean;
  agent_count: number;
  task_count: number;
}

export interface CrewTemplatesResponse {
  agent_templates: string[];
  tools: string[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  components: Record<string, boolean>;
  version: string;
}

// API functions
export const apiClient = {
  // Chat endpoints
  chat: {
    send: (data: ChatRequest) => api.post<ChatResponse>('/chat', data),
  },

  // Image endpoints
  image: {
    generate: (data: ImageRequest) => api.post<ImageResponse>('/image', data),
  },

  // Memory endpoints
  memory: {
    store: (data: MemoryRequest) => api.post<MemoryResponse>('/memory/store', data),
    retrieve: (data: MemoryQueryRequest) => api.post<MemoryQueryResponse>('/memory/retrieve', data),
    getConversation: (conversationId: string, limit?: number) => 
      api.get<ConversationHistoryResponse>(`/memory/conversation/${conversationId}${limit ? `?limit=${limit}` : ''}`),
  },

  // Crew endpoints
  crew: {
    create: (data: CrewRequest) => api.post<CrewResponse>('/crew/create', data),
    run: (crewId: string) => api.post<CrewRunResponse>(`/crew/${crewId}/run`),
    getStatus: (crewId: string) => api.get<CrewStatusResponse>(`/crew/${crewId}/status`),
    getTemplates: () => api.get<CrewTemplatesResponse>('/crew/templates'),
  },

  // Health endpoint
  health: {
    check: () => api.get<HealthResponse>('/health'),
  },
};

export default apiClient;

