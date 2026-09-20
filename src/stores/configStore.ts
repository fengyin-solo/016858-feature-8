import { create } from 'zustand';
import type {
  AppConfig,
  APIKeyScenario,
  APIKeyScenarioErrors,
  ConfigValidation,
} from '../types';
import { DEFAULT_CONFIG } from '../types';
import {
  loadConfig,
  saveConfig,
  loadDemoAPIKey,
  saveDemoAPIKey,
  loadAPIKeyScenario,
  saveAPIKeyScenario,
} from '../services/storage';
import {
  validateConfig,
  validateAPIKey,
  validateTemperature,
  validateMaxTokens,
} from '../utils/validators';

interface ConfigState {
  /** 当前配置 */
  config: AppConfig;
  /** 自用 API Key（沿用原有 react-chat-config 存储） */
  personalAPIKey: string;
  /** 已保存并锁定的演示 API Key */
  demoAPIKey: string;
  /** 演示输入框中尚未锁定的内容，避免切换归属时串到自用 Key */
  demoDraft: string;
  /** 当前使用的 API Key 归属 */
  activeScenario: APIKeyScenario;
  /** 配置是否有效 */
  isValid: boolean;
  /** 配置验证错误信息 */
  errors: ConfigValidation['errors'];
  /** 两套 API Key 各自的错误信息 */
  apiKeyErrors: APIKeyScenarioErrors;
  /** 是否已初始化 */
  initialized: boolean;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 更新非 API Key 配置 */
  updateConfig: (updates: Partial<Omit<AppConfig, 'apiKey'>>) => void;
  /** 验证当前配置 */
  validateCurrentConfig: () => boolean;
  /** 重置为默认配置（演示 Key 不会被清空） */
  resetConfig: () => void;
  /** 设置当前使用的 API Key 归属 */
  setAPIKeyScenario: (scenario: APIKeyScenario) => void;
  /** 设置自用 API Key */
  setPersonalAPIKey: (apiKey: string) => void;
  /** 设置演示 API Key 草稿 */
  setDemoAPIKeyDraft: (apiKey: string) => void;
  /** 保存并锁定演示 API Key */
  saveDemoKey: (apiKey: string) => boolean;
  /** 设置 API Key（保留原有 action 名称） */
  setAPIKey: (apiKey: string) => void;
  /** 设置模型 */
  setModel: (model: string) => void;
  /** 设置 temperature */
  setTemperature: (temperature: number) => void;
  /** 设置 maxTokens */
  setMaxTokens: (maxTokens: number) => void;
}

type ConfigStore = ConfigState & ConfigActions;

function getAPIKeyError(apiKey: string, scenario: APIKeyScenario): string | undefined {
  const label = scenario === 'personal' ? '自用' : '演示';

  if (!apiKey) {
    return `${label} API 密钥为空，请输入 SiliconFlow 密钥`;
  }

  if (!validateAPIKey(apiKey)) {
    return `${label} API 密钥格式无效，请检查后重试`;
  }

  return undefined;
}

function getAPIKeyErrors(personalAPIKey: string, demoDraft: string): APIKeyScenarioErrors {
  return {
    personal: getAPIKeyError(personalAPIKey, 'personal'),
    demo: getAPIKeyError(demoDraft, 'demo'),
  };
}

function getAPIKeyForScenario(
  scenario: APIKeyScenario,
  personalAPIKey: string,
  demoDraft: string,
): string {
  return scenario === 'personal' ? personalAPIKey : demoDraft;
}

export const useConfigStore = create<ConfigStore>((set, get) => {
  function buildValidation(
    nextConfig: AppConfig,
    personalAPIKey: string,
    demoDraft: string,
    activeScenario: APIKeyScenario,
  ) {
    const validation = validateConfig(nextConfig);
    const apiKeyErrors = getAPIKeyErrors(personalAPIKey, demoDraft);

    return {
      isValid: validation.isValid && validateAPIKey(nextConfig.apiKey),
      errors: {
        ...validation.errors,
        apiKey: apiKeyErrors[activeScenario],
      },
      apiKeyErrors,
    };
  }

  return {
    // Initial state
    config: DEFAULT_CONFIG,
    personalAPIKey: '',
    demoAPIKey: '',
    demoDraft: '',
    activeScenario: 'personal',
    isValid: false,
    errors: {},
    apiKeyErrors: {},
    initialized: false,

    // Actions
    initConfig: () => {
      const loadedConfig = loadConfig();
      const demoAPIKey = loadDemoAPIKey();
      const activeScenario = loadAPIKeyScenario();
      const personalAPIKey = loadedConfig.apiKey;
      const activeAPIKey = activeScenario === 'demo' ? demoAPIKey : personalAPIKey;
      const config = { ...loadedConfig, apiKey: activeAPIKey };
      const validation = buildValidation(config, personalAPIKey, demoAPIKey, activeScenario);

      set({
        config,
        personalAPIKey,
        demoAPIKey,
        demoDraft: demoAPIKey,
        activeScenario,
        initialized: true,
        ...validation,
      });
    },

    updateConfig: (updates) => {
      const state = get();
      const newConfig = { ...state.config, ...updates };

      // 非 Key 配置仍然写入原有配置存储；保存时放回自用 Key，避免演示 Key 串入。
      try {
        saveConfig({ ...newConfig, apiKey: state.personalAPIKey });
      } catch (error) {
        console.error('Failed to save config:', error);
      }

      set({
        config: newConfig,
        ...buildValidation(newConfig, state.personalAPIKey, state.demoDraft, state.activeScenario),
      });
    },

    validateCurrentConfig: () => {
      const { config, personalAPIKey, demoDraft, activeScenario } = get();
      const validation = buildValidation(config, personalAPIKey, demoDraft, activeScenario);

      set(validation);
      return validation.isValid;
    },

    resetConfig: () => {
      const state = get();
      const resetBase: AppConfig = {
        ...DEFAULT_CONFIG,
        baseUrl: state.config.baseUrl,
      };

      if (state.activeScenario === 'demo') {
        const config = { ...resetBase, apiKey: state.demoAPIKey };

        // 重置参数时保留两套 Key，尤其不能清空已锁定的演示 Key。
        try {
          saveConfig({ ...resetBase, apiKey: state.personalAPIKey });
        } catch (error) {
          console.error('Failed to save default config:', error);
        }

        set({
          config,
          ...buildValidation(config, state.personalAPIKey, state.demoAPIKey, 'demo'),
        });
        return;
      }

      const config = { ...resetBase, apiKey: '' };

      try {
        saveConfig(config);
      } catch (error) {
        console.error('Failed to save default config:', error);
      }

      set({
        config,
        personalAPIKey: '',
        ...buildValidation(config, '', state.demoAPIKey, 'personal'),
      });
    },

    setAPIKeyScenario: (scenario) => {
      const state = get();
      if (state.activeScenario === scenario) return;

      const apiKey = getAPIKeyForScenario(scenario, state.personalAPIKey, state.demoDraft);
      const config = { ...state.config, apiKey };
      saveAPIKeyScenario(scenario);

      set({
        activeScenario: scenario,
        config,
        ...buildValidation(config, state.personalAPIKey, state.demoDraft, scenario),
      });
    },

    setPersonalAPIKey: (apiKey) => {
      const state = get();
      const personalAPIKey = apiKey;
      const config = state.activeScenario === 'personal'
        ? { ...state.config, apiKey }
        : state.config;

      // 自用 Key 保持原有行为：输入过程即写回原配置存储并执行同一套校验。
      // 即使正在查看演示页签，也只更新原配置中的自用 Key，避免把演示 Key 写进去。
      try {
        saveConfig({ ...state.config, apiKey: personalAPIKey });
      } catch (error) {
        console.error('Failed to save config:', error);
      }

      set({
        personalAPIKey,
        config,
        ...buildValidation(config, personalAPIKey, state.demoDraft, state.activeScenario),
      });
    },

    setDemoAPIKeyDraft: (apiKey) => {
      const state = get();

      // 已锁定的演示 Key 是只读状态，即使绕过界面调用 action 也不能改动。
      if (state.demoAPIKey && state.demoDraft === state.demoAPIKey) {
        return;
      }

      const config = state.activeScenario === 'demo'
        ? { ...state.config, apiKey }
        : state.config;

      set({
        demoDraft: apiKey,
        config,
        ...buildValidation(config, state.personalAPIKey, apiKey, 'demo'),
      });
    },

    saveDemoKey: (apiKey) => {
      const currentState = get();
      if (currentState.demoAPIKey && apiKey !== currentState.demoAPIKey) {
        return false;
      }

      if (!validateAPIKey(apiKey)) {
        return false;
      }

      try {
        saveDemoAPIKey(apiKey);
      } catch (error) {
        console.error('Failed to save demo API key:', error);
        return false;
      }

      const state = get();
      const config = state.activeScenario === 'demo'
        ? { ...state.config, apiKey }
        : state.config;

      set({
        demoAPIKey: apiKey,
        demoDraft: apiKey,
        config,
        ...buildValidation(config, state.personalAPIKey, apiKey, 'demo'),
      });
      return true;
    },

    setAPIKey: (apiKey) => {
      const { activeScenario, setPersonalAPIKey, setDemoAPIKeyDraft } = get();

      if (activeScenario === 'personal') {
        setPersonalAPIKey(apiKey);
      } else {
        setDemoAPIKeyDraft(apiKey);
      }
    },

    setModel: (model) => {
      const { updateConfig } = get();
      updateConfig({ model });
    },

    setTemperature: (temperature) => {
      if (validateTemperature(temperature)) {
        const { updateConfig } = get();
        updateConfig({ temperature });
      }
    },

    setMaxTokens: (maxTokens) => {
      if (validateMaxTokens(maxTokens)) {
        const { updateConfig } = get();
        updateConfig({ maxTokens });
      }
    },
  };
});
