import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PaperAirplaneIcon, MicrophoneIcon, PaperclipIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import useSettingsStore from '@/store/settingsStore';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading = false,
  placeholder = 'Message LexOS...',
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { enableAnimations } = useSettingsStore((state) => state.ui);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="border-t border-border bg-background p-4"
    >
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 bottom-2"
            disabled={isLoading}
          >
            <PaperclipIcon className="h-5 w-5" />
          </Button>
          
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="resize-none min-h-[60px] pr-24 pl-12 py-3 rounded-xl"
            disabled={isLoading}
            rows={1}
          />
          
          <div className="absolute right-2 bottom-2 flex space-x-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isLoading}
            >
              <MicrophoneIcon className="h-5 w-5" />
            </Button>
            
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || isLoading}
              className={cn(
                "bg-primary text-primary-foreground",
                enableAnimations && message.trim() && !isLoading && "animate-pulse-slow"
              )}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground text-center">
          LexOS may produce inaccurate information about people, places, or facts.
        </div>
      </div>
    </form>
  );
};

export default ChatInput;

