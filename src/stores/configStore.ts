import { create } from 'zustand';
import type { APIKeyScope, AppConfig, ConfigValidation } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { saveConfig, loadConfig, saveDemoAPIKey, loadDemoAPIKey } from '../services/storage';
import { validateConfig, validateAPIKey, validateTemperature, validateMaxTokens } from '../utils/validators';

/**
 * 计算当前密钥归属下配置是否可用
 * 自用密钥沿用原有的校验行为；演示密钥单独校验，两套互不影响
 */
function computeIsValid(config: AppConfig, keyScope: APIKeyScope, demoApiKey: string): boolean {
  const validation = validateConfig(config);
  const paramsValid = !validation.errors.temperature && !validation.errors.maxTokens;
  const activeAPIKey = keyScope === 'demo' ? demoApiKey : config.apiKey;
  return paramsValid && validateAPIKey(activeAPIKey);
}

interface ConfigState {
  /** 当前配置（自用密钥沿用原有的本地保存与校验行为） */
  config: AppConfig;
  /** 当前使用的密钥归属 */
  keyScope: APIKeyScope;
  /** 已锁定的演示密钥 */
  demoApiKey: string;
  /** 演示密钥是否已锁定（锁定后只能查看，不能改动也不能被清空） */
  demoKeyLocked: boolean;
  /** 正在填写、尚未锁定的演示密钥草稿 */
  demoKeyDraft: string;
  /** 演示密钥的校验提示 */
  demoKeyError?: string;
  /** 配置是否有效（按当前密钥归属计算） */
  isValid: boolean;
  /** 自用密钥及参数的验证错误信息 */
  errors: ConfigValidation['errors'];
  /** 是否已初始化 */
  initialized: boolean;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 更新配置 */
  updateConfig: (updates: Partial<AppConfig>) => void;
  /** 验证当前配置 */
  validateCurrentConfig: () => boolean;
  /** 重置为默认配置（不影响已锁定的演示密钥） */
  resetConfig: () => void;
  /** 设置 API Key */
  setAPIKey: (apiKey: string) => void;
  /** 设置模型 */
  setModel: (model: string) => void;
  /** 设置 temperature */
  setTemperature: (temperature: number) => void;
  /** 设置 maxTokens */
  setMaxTokens: (maxTokens: number) => void;
  /** 切换当前使用的密钥归属 */
  setKeyScope: (scope: APIKeyScope) => void;
  /** 更新演示密钥草稿（只影响演示这一套，不会写入自用密钥） */
  setDemoKeyDraft: (draft: string) => void;
  /** 保存并锁定演示密钥；已锁定或校验失败时返回 false */
  setDemoAPIKey: (apiKey: string) => boolean;
  /** 获取当前归属下生效的 API Key */
  getActiveAPIKey: () => string;
}

type ConfigStore = ConfigState & ConfigActions;

export const useConfigStore = create<ConfigStore>((set, get) => ({
  // Initial state
  config: DEFAULT_CONFIG,
  keyScope: 'personal',
  demoApiKey: '',
  demoKeyLocked: false,
  demoKeyDraft: '',
  demoKeyError: undefined,
  isValid: false,
  errors: {},
  initialized: false,

  // Actions
  initConfig: () => {
    const loadedConfig = loadConfig();
    const { apiKey: demoApiKey, locked: demoKeyLocked } = loadDemoAPIKey();
    const validation = validateConfig(loadedConfig);

    set({
      config: loadedConfig,
      keyScope: 'personal',
      demoApiKey,
      demoKeyLocked,
      demoKeyDraft: '',
      demoKeyError: undefined,
      isValid: computeIsValid(loadedConfig, 'personal', demoApiKey),
      errors: validation.errors,
      initialized: true,
    });
  },

  updateConfig: (updates) => {
    const { config, keyScope, demoApiKey } = get();
    const newConfig = { ...config, ...updates };
    const validation = validateConfig(newConfig);

    // 保存到 localStorage
    try {
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }

    set({
      config: newConfig,
      isValid: computeIsValid(newConfig, keyScope, demoApiKey),
      errors: validation.errors,
    });
  },

  validateCurrentConfig: () => {
    const { config, keyScope, demoApiKey } = get();
    const validation = validateConfig(config);
    const isValid = computeIsValid(config, keyScope, demoApiKey);

    set({
      isValid,
      errors: validation.errors,
    });

    return isValid;
  },

  resetConfig: () => {
    try {
      saveConfig(DEFAULT_CONFIG);
    } catch (error) {
      console.error('Failed to save default config:', error);
    }

    // 已锁定的演示密钥不能被清空，重置只作用于自用配置
    const { keyScope, demoApiKey } = get();
    set({
      config: DEFAULT_CONFIG,
      isValid: computeIsValid(DEFAULT_CONFIG, keyScope, demoApiKey),
      errors: {},
    });
  },

  setAPIKey: (apiKey) => {
    const { updateConfig } = get();
    updateConfig({ apiKey });
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

  setKeyScope: (scope) => {
    const { config, demoApiKey } = get();
    set({
      keyScope: scope,
      isValid: computeIsValid(config, scope, demoApiKey),
    });
  },

  setDemoKeyDraft: (draft) => {
    // 已锁定后忽略一切改动
    if (get().demoKeyLocked) {
      return;
    }
    set({ demoKeyDraft: draft, demoKeyError: undefined });
  },

  setDemoAPIKey: (apiKey) => {
    // 已锁定的演示密钥不能改动
    if (get().demoKeyLocked) {
      return false;
    }

    const trimmed = apiKey.trim();
    if (!trimmed) {
      set({ demoKeyError: '演示密钥不能为空' });
      return false;
    }
    if (!validateAPIKey(trimmed)) {
      set({ demoKeyError: '演示密钥格式无效，请检查后重试' });
      return false;
    }

    try {
      saveDemoAPIKey(trimmed);
    } catch (error) {
      console.error('Failed to save demo API key:', error);
      set({ demoKeyError: '演示密钥保存失败，请重试' });
      return false;
    }

    const { config, keyScope } = get();
    set({
      demoApiKey: trimmed,
      demoKeyLocked: true,
      demoKeyDraft: '',
      demoKeyError: undefined,
      isValid: computeIsValid(config, keyScope, trimmed),
    });
    return true;
  },

  getActiveAPIKey: () => {
    const { config, keyScope, demoApiKey } = get();
    return keyScope === 'demo' ? demoApiKey : config.apiKey;
  },
}));
