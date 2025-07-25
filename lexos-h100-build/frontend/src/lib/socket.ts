import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  tokens?: number;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  prompt: string;
  conversation_id?: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  task_type?: string;
  user_id?: string;
}

export interface ChatResponse {
  text: string;
  model_used: string;
  provider: string;
  tokens_used: number;
  cost: number;
  latency_ms: number;
  metadata?: Record<string, any>;
  error?: string;
}

// WebSocket client
class WebSocketClient {
  private socket: Socket | null = null;
  private clientId: string;
  private messageHandlers: Map<string, (response: ChatResponse) => void> = new Map();
  private connectionHandlers: Array<(connected: boolean) => void> = [];

  constructor() {
    this.clientId = localStorage.getItem('client_id') || uuidv4();
    localStorage.setItem('client_id', this.clientId);
  }

  // Connect to WebSocket server
  connect() {
    if (this.socket) return;

    this.socket = io(`/ws/chat/${this.clientId}`, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.notifyConnectionHandlers(true);
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.notifyConnectionHandlers(false);
    });

    this.socket.on('message', (response: ChatResponse) => {
      this.handleMessage(response);
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  // Send a chat message
  sendMessage(request: ChatRequest, onResponse: (response: ChatResponse) => void) {
    if (!this.socket) {
      this.connect();
    }

    const messageId = uuidv4();
    this.messageHandlers.set(messageId, onResponse);

    if (this.socket) {
      this.socket.emit('message', {
        ...request,
        message_id: messageId,
      });
    } else {
      onResponse({
        text: 'Error: WebSocket not connected',
        model_used: 'none',
        provider: 'none',
        tokens_used: 0,
        cost: 0,
        latency_ms: 0,
        error: 'WebSocket not connected',
      });
    }
  }

  // Handle incoming messages
  private handleMessage(response: ChatResponse) {
    // For now, we're broadcasting to all handlers
    // In a real app, you'd match the response to the request
    this.messageHandlers.forEach((handler) => {
      handler(response);
    });
  }

  // Register connection state handler
  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }

  // Notify all connection handlers
  private notifyConnectionHandlers(connected: boolean) {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  // Check if connected
  isConnected() {
    return this.socket?.connected || false;
  }
}

// Create singleton instance
export const socketClient = new WebSocketClient();

export default socketClient;

