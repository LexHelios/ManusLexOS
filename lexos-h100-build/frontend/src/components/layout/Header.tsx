import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  PencilIcon, 
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import useChatStore from '@/store/chatStore';
import apiClient from '@/lib/api';

interface HeaderProps {
  activeView: string;
}

const Header: React.FC<HeaderProps> = ({ activeView }) => {
  const { conversations, activeConversationId, updateConversationTitle, deleteConversation } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [healthStatus, setHealthStatus] = useState<{status: string, components: Record<string, boolean>} | null>(null);
  
  const activeConversation = conversations.find(
    (conv) => conv.id === activeConversationId
  );
  
  // Update title when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      setTitle(activeConversation.title);
    }
  }, [activeConversation]);
  
  // Fetch health status
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await apiClient.health.check();
        setHealthStatus({
          status: response.data.status,
          components: response.data.components
        });
      } catch (error) {
        console.error('Failed to fetch health status:', error);
        setHealthStatus({
          status: 'error',
          components: {}
        });
      }
    };
    
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  const handleSaveTitle = () => {
    if (activeConversationId && title.trim()) {
      updateConversationTitle(activeConversationId, title);
      setIsEditing(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      if (activeConversation) {
        setTitle(activeConversation.title);
      }
    }
  };
  
  const handleDelete = () => {
    if (activeConversationId) {
      if (window.confirm('Are you sure you want to delete this conversation?')) {
        deleteConversation(activeConversationId);
      }
    }
  };
  
  const renderTitle = () => {
    if (activeView === 'chat') {
      if (!activeConversation) {
        return <div className="text-lg font-medium">New Chat</div>;
      }
      
      return isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 w-64"
            autoFocus
          />
          <Button variant="ghost" size="icon" onClick={handleSaveTitle}>
            <CheckIcon className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setIsEditing(false);
              if (activeConversation) {
                setTitle(activeConversation.title);
              }
            }}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-lg font-medium">{activeConversation.title}</div>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      );
    } else if (activeView === 'agents') {
      return <div className="text-lg font-medium">Agent Manager</div>;
    } else if (activeView === 'files') {
      return <div className="text-lg font-medium">File Library</div>;
    } else if (activeView === 'settings') {
      return <div className="text-lg font-medium">Settings</div>;
    }
    
    return null;
  };
  
  return (
    <header className="border-b border-border bg-background p-3 flex items-center justify-between">
      <div className="flex items-center">
        {renderTitle()}
      </div>
      
      <div className="flex items-center gap-2">
        {healthStatus && (
          <div className="flex items-center gap-1 text-sm">
            <div className="flex items-center">
              <div 
                className={`w-2 h-2 rounded-full mr-1 ${
                  healthStatus.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                }`} 
              />
              <span className="text-muted-foreground mr-2">Status: {healthStatus.status}</span>
            </div>
            
            {Object.entries(healthStatus.components).map(([name, status]) => (
              <div 
                key={name}
                className="hidden md:flex items-center ml-2" 
                title={`${name}: ${status ? 'Online' : 'Offline'}`}
              >
                <div 
                  className={`w-2 h-2 rounded-full mr-1 ${
                    status ? 'bg-green-500' : 'bg-red-500'
                  }`} 
                />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        )}
        
        <Button variant="outline" size="sm" className="gap-2">
          <CommandLineIcon className="h-4 w-4" />
          <span className="hidden md:inline">Command Menu</span>
        </Button>
        
        <Button variant="ghost" size="icon">
          <InformationCircleIcon className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default Header;

