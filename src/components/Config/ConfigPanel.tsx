import { Drawer, Button, Divider, Segmented, message, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { APIKeyInput } from './APIKeyInput';
import { ModelSelector } from './ModelSelector';
import { ParameterSlider } from './ParameterSlider';
import { useConfigStore } from '../../stores/configStore';
import { useUIStore } from '../../stores/uiStore';
import type { APIKeyScenario } from '../../types';
import './ConfigPanel.css';

const SCENARIO_OPTIONS = [
  { label: '自用密钥', value: 'personal' },
  { label: '演示密钥', value: 'demo' },
];

/**
 * 配置面板组件
 */
export function ConfigPanel() {
  const {
    config,
    errors,
    activeScenario,
    personalAPIKey,
    demoAPIKey,
    demoDraft,
    apiKeyErrors,
    updateConfig,
    resetConfig,
    validateCurrentConfig,
    setAPIKeyScenario,
    setPersonalAPIKey,
    setDemoAPIKeyDraft,
    saveDemoKey,
  } = useConfigStore();

  const { configPanelVisible, setConfigPanelVisible, isMobile } = useUIStore();

  const isDemoLocked = activeScenario === 'demo' && !!demoAPIKey && demoDraft === demoAPIKey;

  const handleClose = () => {
    setConfigPanelVisible(false);
  };

  const handleScenarioChange = (value: APIKeyScenario | string) => {
    setAPIKeyScenario(value as APIKeyScenario);
  };

  const handleSave = () => {
    let lockedDemo = false;

    if (activeScenario === 'demo' && !isDemoLocked) {
      lockedDemo = saveDemoKey(demoDraft);
      if (!lockedDemo) {
        message.error('请填写格式有效的演示 API Key');
        return;
      }
    }

    if (validateCurrentConfig()) {
      message.success(lockedDemo ? '演示密钥已保存并锁定' : '配置已保存');
      handleClose();
    } else {
      message.error(activeScenario === 'demo'
        ? '请检查演示 API Key 配置'
        : '请检查自用 API Key 配置');
    }
  };

  const handleReset = () => {
    resetConfig();
    message.info(activeScenario === 'demo'
      ? '已恢复默认参数，演示密钥不会被清空'
      : '已恢复默认配置');
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
            options={SCENARIO_OPTIONS}
            value={activeScenario}
            onChange={handleScenarioChange}
          />
          <Alert
            type="info"
            showIcon
            message={`当前使用：${activeScenario === 'personal' ? '自用密钥' : '演示密钥'}`}
          />

          {activeScenario === 'personal' ? (
            <APIKeyInput
              key="personal"
              scenario="personal"
              value={personalAPIKey}
              onChange={setPersonalAPIKey}
              error={apiKeyErrors.personal}
            />
          ) : (
            <APIKeyInput
              key="demo"
              scenario="demo"
              value={demoDraft}
              onChange={setDemoAPIKeyDraft}
              error={apiKeyErrors.demo}
              locked={isDemoLocked}
              onSaveDemo={() => {
                if (saveDemoKey(demoDraft)) {
                  message.success('演示密钥已保存并锁定');
                } else {
                  message.error('演示 API Key 格式无效，无法锁定');
                }
              }}
            />
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
          {errors.temperature && <div className="config-field-error">{errors.temperature}</div>}
          {errors.maxTokens && <div className="config-field-error">{errors.maxTokens}</div>}
        </section>
      </div>
    </Drawer>
  );
}
