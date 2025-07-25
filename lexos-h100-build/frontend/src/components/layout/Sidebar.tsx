import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChatBubbleLeftRightIcon, 
  PlusIcon, 
  Cog6ToothIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ArrowLeftOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { cn, timeAgo } from '@/lib/utils';
import useChatStore from '@/store/chatStore';
import useSettingsStore from '@/store/settingsStore';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const { conversations, activeConversationId, createConversation, setActiveConversation } = useChatStore();
  const { sidebarCollapsed, updateUISettings } = useSettingsStore((state) => ({
    sidebarCollapsed: state.ui.sidebarCollapsed,
    updateUISettings: state.updateUISettings,
  }));
  
  const handleNewChat = () => {
    const newId = createConversation('New Conversation');
    setActiveConversation(newId);
    setActiveView('chat');
  };
  
  const toggleSidebar = () => {
    updateUISettings({ sidebarCollapsed: !sidebarCollapsed });
  };
  
  return (
    <div className={cn(
      "bg-secondary/50 border-r border-border flex flex-col transition-all duration-300",
      sidebarCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-3 flex items-center justify-between border-b border-border">
        {!sidebarCollapsed && (
          <div className="font-bold text-lg">LexOS</div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className={cn(
            "h-8 w-8",
            sidebarCollapsed && "mx-auto"
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="p-3">
        <Button 
          onClick={handleNewChat} 
          className={cn(
            "w-full justify-start gap-2",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <PlusIcon className="h-5 w-5" />
          {!sidebarCollapsed && <span>New Chat</span>}
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          {!sidebarCollapsed && (
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Recent Conversations
            </div>
          )}
          
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                variant={conversation.id === activeConversationId ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start text-left overflow-hidden",
                  sidebarCollapsed ? "justify-center px-0" : "px-3"
                )}
                onClick={() => {
                  setActiveConversation(conversation.id);
                  setActiveView('chat');
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 flex-shrink-0" />
                  
                  {!sidebarCollapsed && (
                    <div className="truncate flex-1">
                      <div className="truncate">{conversation.title}</div>
                      {conversation.updatedAt && (
                        <div className="text-xs text-muted-foreground">
                          {timeAgo(conversation.updatedAt)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-3 border-t border-border space-y-1">
        <Button
          variant={activeView === 'agents' ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start gap-2",
            sidebarCollapsed && "justify-center px-0"
          )}
          onClick={() => setActiveView('agents')}
        >
          <UserGroupIcon className="h-5 w-5" />
          {!sidebarCollapsed && <span>Agents</span>}
        </Button>
        
        <Button
          variant={activeView === 'files' ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start gap-2",
            sidebarCollapsed && "justify-center px-0"
          )}
          onClick={() => setActiveView('files')}
        >
          <DocumentTextIcon className="h-5 w-5" />
          {!sidebarCollapsed && <span>Files</span>}
        </Button>
        
        <Button
          variant={activeView === 'settings' ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start gap-2",
            sidebarCollapsed && "justify-center px-0"
          )}
          onClick={() => setActiveView('settings')}
        >
          <Cog6ToothIcon className="h-5 w-5" />
          {!sidebarCollapsed && <span>Settings</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;

