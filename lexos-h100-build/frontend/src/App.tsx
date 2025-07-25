import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ChatContainer from './components/chat/ChatContainer';
import AgentManager from './components/agents/AgentManager';
import FileLibrary from './components/files/FileLibrary';
import SettingsPanel from './components/settings/SettingsPanel';
import useSettingsStore from './store/settingsStore';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<string>('chat');
  const { theme } = useSettingsStore((state) => state.ui);
  
  // Apply theme on mount and when theme changes
  useEffect(() => {
    const applyTheme = () => {
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    applyTheme();
    
    // Listen for system theme changes if using system theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);
  
  // Render active view
  const renderActiveView = () => {
    switch (activeView) {
      case 'chat':
        return <ChatContainer />;
      case 'agents':
        return <AgentManager />;
      case 'files':
        return <FileLibrary />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <ChatContainer />;
    }
  };
  
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeView={activeView} />
        <main className="flex-1 overflow-hidden">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export default App;

