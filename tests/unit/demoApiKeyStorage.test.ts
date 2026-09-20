import { describe, it, expect, beforeEach } from 'vitest';

// node 环境下没有 localStorage，这里mock一份（tests/setup.ts 未被 vitest 配置引用）
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  },
  writable: true,
});

import {
  saveConfig,
  loadConfig,
  saveDemoAPIKey,
  loadDemoAPIKey,
  clearAllStorage,
} from '../../src/services/storage';
import { DEFAULT_CONFIG } from '../../src/types';

const VALID_DEMO_KEY = 'sk-demo_key-1234567890';

beforeEach(() => {
  localStorage.clear();
});

describe('演示密钥的本地缓存', () => {
  it('保存后可以读回，且与自用密钥分开缓存', () => {
    saveDemoAPIKey(VALID_DEMO_KEY);

    const { apiKey, locked } = loadDemoAPIKey();
    expect(apiKey).toBe(VALID_DEMO_KEY);
    expect(locked).toBe(true);

    // 演示密钥有独立的 storage key，不与自用配置混存
    expect(localStorage.getItem('react-chat-demo-api-key')).not.toBeNull();
    expect(localStorage.getItem('react-chat-config')).toBeNull();
  });

  it('锁定状态在重新加载（模拟刷新 / 返回）后仍保持只读', () => {
    saveDemoAPIKey(VALID_DEMO_KEY);

    // 模拟刷新后再次读取
    const afterReload = loadDemoAPIKey();
    expect(afterReload.locked).toBe(true);
    expect(afterReload.apiKey).toBe(VALID_DEMO_KEY);
  });

  it('从未保存时返回未锁定的空密钥', () => {
    const { apiKey, locked } = loadDemoAPIKey();
    expect(apiKey).toBe('');
    expect(locked).toBe(false);
  });

  it('clearAllStorage 不会清空已锁定的演示密钥', () => {
    saveDemoAPIKey(VALID_DEMO_KEY);
    saveConfig({ ...DEFAULT_CONFIG, apiKey: 'sk-personal_key-0001' });

    clearAllStorage();

    // 自用配置被清除，演示密钥保留
    expect(loadConfig().apiKey).toBe('');
    expect(loadDemoAPIKey()).toEqual({ apiKey: VALID_DEMO_KEY, locked: true });
  });

  it('自用密钥沿用原有的本地保存行为（加密存储、读取解密）', () => {
    const personalKey = 'sk-personal_key-0001';
    saveConfig({ ...DEFAULT_CONFIG, apiKey: personalKey });

    // 本地不出现明文
    expect(localStorage.getItem('react-chat-config')).not.toContain(personalKey);
    // 读取时还原
    expect(loadConfig().apiKey).toBe(personalKey);
  });
});
