
import { Drawer, Button, Divider, Segmented, message } from 'antd';
import { SaveOutlined, ReloadOutlined, LockOutlined } from '@ant-design/icons';
import { APIKeyInput } from './APIKeyInput';
import { ModelSelector } from './ModelSelector';
import { ParameterSlider } from './ParameterSlider';
import { useConfigStore } from '../../stores/configStore';
import { useUIStore } from '../../stores/uiStore';
import type { APIKeyScope } from '../../types';
import { validateAPIKey } from '../../utils/validators';
import './ConfigPanel.css';

/**
 * 配置面板组件
 */
export function ConfigPanel() {
  const {
    config,
    errors,
    updateConfig,
    resetConfig,
    validateCurrentConfig,
    keyScope,
    setKeyScope,
    demoApiKey,
    demoKeyLocked,
    demoKeyDraft,
    demoKeyError,
    setDemoKeyDraft,
    setDemoAPIKey,
  } = useConfigStore();

  const { configPanelVisible, setConfigPanelVisible, isMobile } = useUIStore();

  const isDemoScope = keyScope === 'demo';
  const demoReadOnly = isDemoScope && demoKeyLocked;

  // 两套归属各自独立的取值，来回切换时正在填写的内容不会串到另一套
  const apiKeyValue = !isDemoScope
    ? config.apiKey
    : demoKeyLocked
      ? demoApiKey
      : demoKeyDraft;

  // 两套归属各自的为空 / 格式无效提示
  const apiKeyError = !isDemoScope
    ? errors.apiKey
    : demoKeyError ??
      (demoKeyDraft && !validateAPIKey(demoKeyDraft)
        ? '演示密钥格式无效，请检查后重试'
        : undefined);

  const handleClose = () => {
    setConfigPanelVisible(false);
  };

  const handleSave = () => {
    if (validateCurrentConfig()) {
      message.success('配置已保存');
      handleClose();
    } else {
      message.error('请检查配置项');
    }
  };

  const handleReset = () => {
    resetConfig();
    message.info('已恢复默认配置');
  };

  const handleScopeChange = (value: string | number) => {
    setKeyScope(value as APIKeyScope);
  };

  const handleAPIKeyChange = (value: string) => {
    if (isDemoScope) {
      setDemoKeyDraft(value);
    } else {
      updateConfig({ apiKey: value });
    }
  };

  const handleLockDemoKey = () => {
    if (setDemoAPIKey(demoKeyDraft)) {
      message.success('演示密钥已保存并锁定，仅可查看');
    }
  };

  return (
    <Drawer
      title="设置"
      placement="right"
      width={isMobile ? '100%' : 400}
      open={configPanelVisible}
      onClose={handleClose}
      className="config-panel"
      footer={
        <div className="config-panel-footer">
          <Button onClick={handleReset} icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>
            保存
          </Button>
        </div>
      }
    >
      <div className="config-panel-content">
        <section className="config-section">
          <h3 className="section-title">API 配置</h3>
          <Segmented
            block
            value={keyScope}
            onChange={handleScopeChange}
            options={[
              { label: '自用密钥', value: 'personal' },
              { label: '演示密钥', value: 'demo' },
            ]}
          />
          <APIKeyInput
            scope={keyScope}
            value={apiKeyValue}
            onChange={handleAPIKeyChange}
            error={apiKeyError}
            readOnly={demoReadOnly}
          />
          {isDemoScope && !demoKeyLocked && (
            <Button
              type="primary"
              ghost
              icon={<LockOutlined />}
              onClick={handleLockDemoKey}
            >
              保存并锁定演示密钥
            </Button>
          )}
        </section>

        <Divider />

        <section className="config-section">
          <h3 className="section-title">模型设置</h3>
          <ModelSelector
            value={config.model}
            onChange={(value) => updateConfig({ model: value })}
          />
        </section>

        <Divider />

        <section className="config-section">
          <h3 className="section-title">参数调整</h3>
          <ParameterSlider
            temperature={config.temperature}
            maxTokens={config.maxTokens}
            onTemperatureChange={(value) => updateConfig({ temperature: value })}
            onMaxTokensChange={(value) => updateConfig({ maxTokens: value })}
          />
        </section>
      </div>
    </Drawer>
  );
}
