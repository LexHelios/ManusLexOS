import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ModelSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  preferredProvider: string | null;
  preferredModel: string | null;
}

interface UISettings {
  theme: Theme;
  fontSize: number;
  showTokenCount: boolean;
  showModelInfo: boolean;
  showTimestamps: boolean;
  enableAnimations: boolean;
  sidebarCollapsed: boolean;
  codeBlockTheme: string;
}

interface SettingsState {
  model: ModelSettings;
  ui: UISettings;
  
  // Actions
  updateModelSettings: (settings: Partial<ModelSettings>) => void;
  updateUISettings: (settings: Partial<UISettings>) => void;
  resetModelSettings: () => void;
  resetUISettings: () => void;
  resetAllSettings: () => void;
}

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.7,
  maxTokens: 1024,
  topP: 0.9,
  preferredProvider: null,
  preferredModel: null,
};

const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'system',
  fontSize: 16,
  showTokenCount: true,
  showModelInfo: true,
  showTimestamps: false,
  enableAnimations: true,
  sidebarCollapsed: false,
  codeBlockTheme: 'github-dark',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: DEFAULT_MODEL_SETTINGS,
      ui: DEFAULT_UI_SETTINGS,

      updateModelSettings: (settings) => {
        set((state) => ({
          model: { ...state.model, ...settings },
        }));
      },

      updateUISettings: (settings) => {
        set((state) => ({
          ui: { ...state.ui, ...settings },
        }));
      },

      resetModelSettings: () => {
        set({ model: DEFAULT_MODEL_SETTINGS });
      },

      resetUISettings: () => {
        set({ ui: DEFAULT_UI_SETTINGS });
      },

      resetAllSettings: () => {
        set({
          model: DEFAULT_MODEL_SETTINGS,
          ui: DEFAULT_UI_SETTINGS,
        });
      },
    }),
    {
      name: 'lexos-settings-store',
    }
  )
);

export default useSettingsStore;

