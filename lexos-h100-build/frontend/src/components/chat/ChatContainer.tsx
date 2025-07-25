import React, { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { v4 as uuidv4 } from 'uuid';
import useChatStore from '@/store/chatStore';
import useSettingsStore from '@/store/settingsStore';
import { socketClient, ChatMessage as ChatMessageType } from '@/lib/socket';
import apiClient from '@/lib/api';

const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    conversations, 
    activeConversationId, 
    createConversation, 
    addMessage, 
    setActiveConversation 
  } = useChatStore();
  
  const { model: modelSettings } = useSettingsStore();
  
  // Get active conversation
  const activeConversation = conversations.find(
    (conv) => conv.id === activeConversationId
  );
  
  // Create a new conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      const newId = createConversation('New Conversation');
      setActiveConversation(newId);
    } else if (!activeConversationId) {
      setActiveConversation(conversations[0].id);
    }
  }, [conversations, activeConversationId, createConversation, setActiveConversation]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);
  
  // Connect to WebSocket
  useEffect(() => {
    socketClient.connect();
    
    return () => {
      socketClient.disconnect();
    };
  }, []);
  
  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) return;
    
    // Create user message
    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    // Add user message to conversation
    addMessage(userMessage);
    
    // Create placeholder for assistant message
    const assistantMessageId = uuidv4();
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: 'assistant',
      content: '...',
      timestamp: Date.now(),
    };
    
    // Add placeholder message
    addMessage(assistantMessage);
    
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await apiClient.chat.send({
        prompt: content,
        conversation_id: activeConversationId,
        system_prompt: activeConversation?.systemPrompt,
        max_tokens: modelSettings.maxTokens,
        temperature: modelSettings.temperature,
        top_p: modelSettings.topP,
        force_provider: modelSettings.preferredProvider || undefined,
      });
      
      // Update assistant message with response
      const updatedAssistantMessage: ChatMessageType = {
        id: assistantMessageId,
        role: 'assistant',
        content: response.data.text,
        timestamp: Date.now(),
        model: response.data.model_used,
        provider: response.data.provider,
        tokens: response.data.tokens_used,
        cost: response.data.cost,
        metadata: response.data.metadata,
      };
      
      // Replace placeholder with actual response
      useChatStore.getState().updateMessage(assistantMessageId, response.data.text);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update with error message
      useChatStore.getState().updateMessage(
        assistantMessageId, 
        'Sorry, there was an error processing your request. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {activeConversation?.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <h2 className="text-2xl font-bold mb-2">Welcome to LexOS</h2>
              <p className="text-muted-foreground mb-4">
                Your H100-powered AI assistant. Ask me anything or give me a task to complete.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {activeConversation?.messages.map((message, index) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                isLastMessage={isLoading && index === activeConversation.messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default ChatContainer;

