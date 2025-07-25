import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useSettingsStore, { Theme } from '@/store/settingsStore';

const SettingsPanel: React.FC = () => {
  const { 
    model, 
    ui, 
    updateModelSettings, 
    updateUISettings, 
    resetModelSettings, 
    resetUISettings, 
    resetAllSettings 
  } = useSettingsStore();
  
  const handleThemeChange = (theme: Theme) => {
    updateUISettings({ theme });
    
    // Apply theme to document
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        
        <div className="space-y-8">
          {/* Model Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4 pb-1 border-b border-border">Model Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Temperature: {model.temperature}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">0.0</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={model.temperature}
                    onChange={(e) => updateModelSettings({ temperature: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm">1.0</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lower values make output more focused and deterministic. Higher values make output more creative and varied.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Max Tokens: {model.maxTokens}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">256</span>
                  <input
                    type="range"
                    min="256"
                    max="4096"
                    step="256"
                    value={model.maxTokens}
                    onChange={(e) => updateModelSettings({ maxTokens: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm">4096</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of tokens to generate in the response.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Top P: {model.topP}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">0.1</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={model.topP}
                    onChange={(e) => updateModelSettings({ topP: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm">1.0</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Controls diversity via nucleus sampling. Lower values make output more focused.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Provider</label>
                <select
                  value={model.preferredProvider || ''}
                  onChange={(e) => updateModelSettings({ 
                    preferredProvider: e.target.value === '' ? null : e.target.value 
                  })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Auto (recommended)</option>
                  <option value="local">Local H100</option>
                  <option value="together">Together API</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select your preferred model provider. Auto will choose the best provider based on the task.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Model</label>
                <select
                  value={model.preferredModel || ''}
                  onChange={(e) => updateModelSettings({ 
                    preferredModel: e.target.value === '' ? null : e.target.value 
                  })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Auto (recommended)</option>
                  <option value="qwen2.5-72b">Qwen 2.5 (72B)</option>
                  <option value="deepseek-r1">DeepSeek R1</option>
                  <option value="llama-3.1-70b">Llama 3.1 (70B)</option>
                  <option value="llama-3.1-8b">Llama 3.1 (8B)</option>
                  <option value="codellama-34b">CodeLlama (34B)</option>
                  <option value="codellama-7b">CodeLlama (7B)</option>
                  <option value="mixtral-8x22b">Mixtral (8x22B)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select your preferred model. Auto will choose the best model based on the task.
                </p>
              </div>
              
              <div>
                <Button 
                  variant="outline" 
                  onClick={resetModelSettings}
                >
                  Reset Model Settings
                </Button>
              </div>
            </div>
          </div>
          
          {/* UI Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4 pb-1 border-b border-border">UI Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Theme</label>
                <div className="flex gap-2">
                  <Button
                    variant={ui.theme === 'light' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => handleThemeChange('light')}
                  >
                    Light
                  </Button>
                  <Button
                    variant={ui.theme === 'dark' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => handleThemeChange('dark')}
                  >
                    Dark
                  </Button>
                  <Button
                    variant={ui.theme === 'system' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => handleThemeChange('system')}
                  >
                    System
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Font Size: {ui.fontSize}px</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">12</span>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    value={ui.fontSize}
                    onChange={(e) => updateUISettings({ fontSize: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm">20</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">Display Options</label>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showTokenCount"
                    checked={ui.showTokenCount}
                    onChange={(e) => updateUISettings({ showTokenCount: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="showTokenCount" className="text-sm">Show token count</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showModelInfo"
                    checked={ui.showModelInfo}
                    onChange={(e) => updateUISettings({ showModelInfo: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="showModelInfo" className="text-sm">Show model information</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showTimestamps"
                    checked={ui.showTimestamps}
                    onChange={(e) => updateUISettings({ showTimestamps: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="showTimestamps" className="text-sm">Show timestamps</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableAnimations"
                    checked={ui.enableAnimations}
                    onChange={(e) => updateUISettings({ enableAnimations: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="enableAnimations" className="text-sm">Enable animations</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sidebarCollapsed"
                    checked={ui.sidebarCollapsed}
                    onChange={(e) => updateUISettings({ sidebarCollapsed: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="sidebarCollapsed" className="text-sm">Collapse sidebar by default</label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Code Block Theme</label>
                <select
                  value={ui.codeBlockTheme}
                  onChange={(e) => updateUISettings({ codeBlockTheme: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="github-dark">GitHub Dark</option>
                  <option value="github-light">GitHub Light</option>
                  <option value="dracula">Dracula</option>
                  <option value="nord">Nord</option>
                  <option value="solarized-dark">Solarized Dark</option>
                  <option value="solarized-light">Solarized Light</option>
                </select>
              </div>
              
              <div>
                <Button 
                  variant="outline" 
                  onClick={resetUISettings}
                >
                  Reset UI Settings
                </Button>
              </div>
            </div>
          </div>
          
          {/* Advanced Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4 pb-1 border-b border-border">Advanced Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset all settings to default?')) {
                      resetAllSettings();
                    }
                  }}
                >
                  Reset All Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;

