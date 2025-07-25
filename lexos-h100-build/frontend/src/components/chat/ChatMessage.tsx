import React from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/socket';
import { cn, formatNumber, timeAgo } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import useSettingsStore from '@/store/settingsStore';

interface ChatMessageProps {
  message: ChatMessageType;
  isLastMessage?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLastMessage = false }) => {
  const { showTokenCount, showModelInfo, showTimestamps } = useSettingsStore((state) => state.ui);
  
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div 
      className={cn(
        'py-5 px-4 flex flex-col',
        isUser ? 'bg-secondary/30' : 'bg-background',
        isSystem && 'bg-muted/30 text-muted-foreground italic',
        isLastMessage && 'animate-pulse-slow'
      )}
    >
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center mb-2">
          <div 
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
              isSystem && 'bg-muted text-muted-foreground'
            )}
          >
            {isUser ? 'U' : isSystem ? 'S' : 'A'}
          </div>
          <div className="ml-2 font-medium">
            {isUser ? 'You' : isSystem ? 'System' : 'LexOS'}
          </div>
          
          {showTimestamps && (
            <div className="ml-auto text-xs text-muted-foreground">
              {timeAgo(message.timestamp)}
            </div>
          )}
        </div>
        
        <div className="ml-10">
          <div className="prose dark:prose-invert max-w-none markdown-content">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
          {!isUser && !isSystem && showModelInfo && message.model && (
            <div className="mt-4 text-xs text-muted-foreground flex flex-wrap gap-2">
              <span className="bg-secondary/50 px-2 py-1 rounded">
                {message.model}
              </span>
              
              {message.provider && (
                <span className="bg-secondary/50 px-2 py-1 rounded">
                  {message.provider}
                </span>
              )}
              
              {showTokenCount && message.tokens && (
                <span className="bg-secondary/50 px-2 py-1 rounded">
                  {formatNumber(message.tokens)} tokens
                </span>
              )}
              
              {message.cost !== undefined && (
                <span className="bg-secondary/50 px-2 py-1 rounded">
                  ${message.cost.toFixed(4)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;

