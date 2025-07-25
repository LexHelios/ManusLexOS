import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '@/lib/socket';
import apiClient from '@/lib/api';

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createConversation: (title?: string, systemPrompt?: string) => string;
  setActiveConversation: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearConversations: () => void;
  loadConversationHistory: (conversationId: string) => Promise<void>;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  updateConversationTitle: (id: string, title: string) => void;
  updateSystemPrompt: (id: string, systemPrompt: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      error: null,

      createConversation: (title = 'New Conversation', systemPrompt) => {
        const id = uuidv4();
        const conversation: Conversation = {
          id,
          title,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          systemPrompt,
        };

        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));

        return id;
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      addMessage: (message) => {
        set((state) => {
          const { activeConversationId, conversations } = state;
          if (!activeConversationId) return state;

          const updatedConversations = conversations.map((conv) => {
            if (conv.id === activeConversationId) {
              return {
                ...conv,
                messages: [...conv.messages, message],
                updatedAt: Date.now(),
              };
            }
            return conv;
          });

          return { conversations: updatedConversations };
        });
      },

      updateMessage: (id, content) => {
        set((state) => {
          const { activeConversationId, conversations } = state;
          if (!activeConversationId) return state;

          const updatedConversations = conversations.map((conv) => {
            if (conv.id === activeConversationId) {
              const updatedMessages = conv.messages.map((msg) => {
                if (msg.id === id) {
                  return { ...msg, content };
                }
                return msg;
              });

              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
            }
            return conv;
          });

          return { conversations: updatedConversations };
        });
      },

      deleteMessage: (id) => {
        set((state) => {
          const { activeConversationId, conversations } = state;
          if (!activeConversationId) return state;

          const updatedConversations = conversations.map((conv) => {
            if (conv.id === activeConversationId) {
              return {
                ...conv,
                messages: conv.messages.filter((msg) => msg.id !== id),
                updatedAt: Date.now(),
              };
            }
            return conv;
          });

          return { conversations: updatedConversations };
        });
      },

      deleteConversation: (id) => {
        set((state) => {
          const { conversations, activeConversationId } = state;
          const updatedConversations = conversations.filter((conv) => conv.id !== id);
          
          // If we're deleting the active conversation, set a new active one
          let newActiveId = activeConversationId;
          if (activeConversationId === id) {
            newActiveId = updatedConversations.length > 0 ? updatedConversations[0].id : null;
          }

          return {
            conversations: updatedConversations,
            activeConversationId: newActiveId,
          };
        });
      },

      clearConversations: () => {
        set({ conversations: [], activeConversationId: null });
      },

      loadConversationHistory: async (conversationId) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiClient.memory.getConversation(conversationId);
          const history = response.data.history;
          
          // Convert API response to our message format
          const messages: ChatMessage[] = history.map((item, index) => ({
            id: `history-${index}-${Date.now()}`,
            role: 'user',
            content: item.user,
            timestamp: new Date(item.metadata.timestamp || Date.now()).getTime(),
            metadata: item.metadata,
          })).flatMap((userMsg, index) => {
            const item = history[index];
            const assistantMsg: ChatMessage = {
              id: `history-${index}-assistant-${Date.now()}`,
              role: 'assistant',
              content: item.assistant,
              timestamp: new Date(item.metadata.timestamp || Date.now()).getTime() + 1, // +1 to ensure order
              model: item.metadata.model_used,
              provider: item.metadata.provider,
              tokens: item.metadata.tokens_used,
              cost: item.metadata.cost,
              metadata: item.metadata,
            };
            return [userMsg, assistantMsg];
          });
          
          // Update the conversation with loaded messages
          set((state) => {
            const updatedConversations = state.conversations.map((conv) => {
              if (conv.id === conversationId) {
                return {
                  ...conv,
                  messages,
                  updatedAt: Date.now(),
                };
              }
              return conv;
            });
            
            return { conversations: updatedConversations, isLoading: false };
          });
        } catch (error) {
          console.error('Failed to load conversation history:', error);
          set({ 
            error: 'Failed to load conversation history', 
            isLoading: false 
          });
        }
      },

      setError: (error) => {
        set({ error });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      updateConversationTitle: (id, title) => {
        set((state) => {
          const updatedConversations = state.conversations.map((conv) => {
            if (conv.id === id) {
              return { ...conv, title, updatedAt: Date.now() };
            }
            return conv;
          });
          
          return { conversations: updatedConversations };
        });
      },

      updateSystemPrompt: (id, systemPrompt) => {
        set((state) => {
          const updatedConversations = state.conversations.map((conv) => {
            if (conv.id === id) {
              return { ...conv, systemPrompt, updatedAt: Date.now() };
            }
            return conv;
          });
          
          return { conversations: updatedConversations };
        });
      },
    }),
    {
      name: 'lexos-chat-store',
    }
  )
);

export default useChatStore;

