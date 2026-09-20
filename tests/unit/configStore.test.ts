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

import { useConfigStore } from '../../src/stores/configStore';
import { DEFAULT_CONFIG } from '../../src/types';

const VALID_PERSONAL_KEY = 'sk-personal_key-0001';
const VALID_DEMO_KEY = 'sk-demo_key-1234567890';

function resetStore() {
  localStorage.clear();
  useConfigStore.setState({
    config: DEFAULT_CONFIG,
    keyScope: 'personal',
    demoApiKey: '',
    demoKeyLocked: false,
    demoKeyDraft: '',
    demoKeyError: undefined,
    isValid: false,
    errors: {},
    initialized: false,
  });
}

beforeEach(resetStore);

describe('自用密钥（原有行为不受影响）', () => {
  it('更新自用密钥仍写入原有本地缓存并即时校验', () => {
    useConfigStore.getState().updateConfig({ apiKey: VALID_PERSONAL_KEY });

    const state = useConfigStore.getState();
    expect(state.config.apiKey).toBe(VALID_PERSONAL_KEY);
    expect(state.isValid).toBe(true);
    expect(state.errors.apiKey).toBeUndefined();
    // 原有 storage key 不变
    expect(localStorage.getItem('react-chat-config')).not.toBeNull();
  });

  it('自用密钥格式无效时给出原有提示', () => {
    useConfigStore.getState().updateConfig({ apiKey: 'bad key!' });

    const state = useConfigStore.getState();
    expect(state.isValid).toBe(false);
    expect(state.errors.apiKey).toBe('API 密钥格式无效，请检查后重试');
  });
});

describe('演示密钥的锁定', () => {
  it('填好并保存后锁定为只读，不能再改动', () => {
    const ok = useConfigStore.getState().setDemoAPIKey(VALID_DEMO_KEY);
    expect(ok).toBe(true);

    const locked = useConfigStore.getState();
    expect(locked.demoKeyLocked).toBe(true);
    expect(locked.demoApiKey).toBe(VALID_DEMO_KEY);

    // 锁定后再次写入被拒绝
    const again = useConfigStore.getState().setDemoAPIKey('sk-another_key-9999');
    expect(again).toBe(false);
    expect(useConfigStore.getState().demoApiKey).toBe(VALID_DEMO_KEY);

    // 锁定后草稿写入也被忽略
    useConfigStore.getState().setDemoKeyDraft('sk-whatever-0000');
    expect(useConfigStore.getState().demoKeyDraft).toBe('');
  });

  it('刷新（重新初始化）后演示密钥仍保持只读', () => {
    useConfigStore.getState().setDemoAPIKey(VALID_DEMO_KEY);

    // 模拟刷新：重置内存状态后从 localStorage 重新初始化
    useConfigStore.setState({
      config: DEFAULT_CONFIG,
      keyScope: 'personal',
      demoApiKey: '',
      demoKeyLocked: false,
      demoKeyDraft: '',
      demoKeyError: undefined,
      isValid: false,
      errors: {},
      initialized: false,
    });
    useConfigStore.getState().initConfig();

    const state = useConfigStore.getState();
    expect(state.demoKeyLocked).toBe(true);
    expect(state.demoApiKey).toBe(VALID_DEMO_KEY);
  });

  it('重置配置不会清空已锁定的演示密钥', () => {
    useConfigStore.getState().setDemoAPIKey(VALID_DEMO_KEY);
    useConfigStore.getState().resetConfig();

    const state = useConfigStore.getState();
    expect(state.config.apiKey).toBe('');
    expect(state.demoApiKey).toBe(VALID_DEMO_KEY);
    expect(state.demoKeyLocked).toBe(true);
  });
});

describe('两套归属互不串值', () => {
  it('来回切换归属时，正在填写的内容不会串到另一套', () => {
    // 自用里填了一半
    useConfigStore.getState().updateConfig({ apiKey: 'sk-partial-personal' });
    // 切到演示，也填了一半
    useConfigStore.getState().setKeyScope('demo');
    useConfigStore.getState().setDemoKeyDraft('sk-partial-demo');
    // 切回自用
    useConfigStore.getState().setKeyScope('personal');

    const state = useConfigStore.getState();
    // 各自的值保持独立
    expect(state.config.apiKey).toBe('sk-partial-personal');
    expect(state.demoKeyDraft).toBe('sk-partial-demo');
    expect(state.demoApiKey).toBe('');
  });

  it('两套的取值分别缓存在本机的不同位置', () => {
    useConfigStore.getState().updateConfig({ apiKey: VALID_PERSONAL_KEY });
    useConfigStore.getState().setDemoAPIKey(VALID_DEMO_KEY);

    const configRecord = localStorage.getItem('react-chat-config');
    const demoRecord = localStorage.getItem('react-chat-demo-api-key');
    expect(configRecord).not.toBeNull();
    expect(demoRecord).not.toBeNull();
    // 两套缓存互不包含对方的明文
    expect(configRecord).not.toContain(VALID_DEMO_KEY);
    expect(demoRecord).not.toContain(VALID_PERSONAL_KEY);
  });
});

describe('两套归属各自的空 / 无效提示', () => {
  it('演示密钥为空时给出演示自己的提示', () => {
    const ok = useConfigStore.getState().setDemoAPIKey('   ');
    expect(ok).toBe(false);
    expect(useConfigStore.getState().demoKeyError).toBe('演示密钥不能为空');
  });

  it('演示密钥格式无效时给出演示自己的提示', () => {
    const ok = useConfigStore.getState().setDemoAPIKey('bad key!');
    expect(ok).toBe(false);
    expect(useConfigStore.getState().demoKeyError).toBe('演示密钥格式无效，请检查后重试');
  });

  it('演示密钥的提示不影响自用密钥的校验结果', () => {
    useConfigStore.getState().setDemoAPIKey('bad key!');
    useConfigStore.getState().updateConfig({ apiKey: VALID_PERSONAL_KEY });

    const state = useConfigStore.getState();
    expect(state.errors.apiKey).toBeUndefined();
    expect(state.isValid).toBe(true);
  });
});

describe('当前生效的密钥随归属切换', () => {
  it('getActiveAPIKey 按当前归属返回对应密钥', () => {
    useConfigStore.getState().updateConfig({ apiKey: VALID_PERSONAL_KEY });
    useConfigStore.getState().setDemoAPIKey(VALID_DEMO_KEY);

    expect(useConfigStore.getState().getActiveAPIKey()).toBe(VALID_PERSONAL_KEY);

    useConfigStore.getState().setKeyScope('demo');
    expect(useConfigStore.getState().getActiveAPIKey()).toBe(VALID_DEMO_KEY);
  });

  it('isValid 按当前归属的密钥计算', () => {
    // 自用为空、演示已锁定有效密钥
    useConfigStore.getState().setDemoAPIKey(VALID_DEMO_KEY);
    expect(useConfigStore.getState().isValid).toBe(false);

    useConfigStore.getState().setKeyScope('demo');
    expect(useConfigStore.getState().isValid).toBe(true);

    // 切回自用（空密钥）则无效
    useConfigStore.getState().setKeyScope('personal');
    expect(useConfigStore.getState().isValid).toBe(false);
  });
});
