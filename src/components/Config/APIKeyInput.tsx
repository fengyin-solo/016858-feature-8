import { useState, type ClipboardEvent } from 'react';
import { Input, Button, Space, Typography, Tag } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { validateAPIKey } from '../../utils/validators';
import type { APIKeyScenario } from '../../types';
import './APIKeyInput.css';

const { Text } = Typography;

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  scenario: APIKeyScenario;
  locked?: boolean;
  onSaveDemo?: () => void;
}

const SCENARIO_TEXT: Record<APIKeyScenario, { label: string; placeholder: string; hint: string }> = {
  personal: {
    label: '自用 API Key（当前使用）',
    placeholder: '请输入自用 SiliconFlow API Key',
    hint: '从 SiliconFlow 控制台获取 API Key；可随时修改或清空。',
  },
  demo: {
    label: '演示 API Key（当前使用）',
    placeholder: '请输入演示 SiliconFlow API Key',
    hint: '演示密钥保存并锁定后仅可查看，不能修改或清空。',
  },
};

/**
 * API 密钥输入组件
 */
export function APIKeyInput({
  value,
  onChange,
  error,
  scenario,
  locked = false,
  onSaveDemo,
}: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const isValid = validateAPIKey(value);
  const text = SCENARIO_TEXT[scenario];

  const toggleVisibility = () => {
    setVisible(!visible);
  };

  const getStatus = (): '' | 'error' | undefined => {
    if (!value) return undefined;
    return isValid ? '' : 'error';
  };

  const getSuffix = () => {
    if (!value) return null;

    return (
      <Space size={4}>
        {isValid ? (
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
        ) : (
          <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />
        )}
        <Button
          type="text"
          size="small"
          aria-label={visible ? '隐藏 API Key' : '查看 API Key'}
          icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={toggleVisibility}
        />
      </Space>
    );
  };

  const preventReadOnlyChange = (event: ClipboardEvent<HTMLInputElement>) => {
    if (locked) {
      event.preventDefault();
    }
  };

  return (
    <div className="api-key-input">
      <div className="input-label-row">
        <label className="input-label" htmlFor={`api-key-${scenario}`}>
          {text.label}
        </label>
        {scenario === 'demo' && (
          <Tag icon={locked ? <LockOutlined /> : undefined} color={locked ? 'default' : 'blue'}>
            {locked ? '已锁定 · 只读' : '填写后锁定'}
          </Tag>
        )}
      </div>

      <Input
        id={`api-key-${scenario}`}
        className="api-key-field"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => {
          if (!locked) {
            onChange(e.target.value);
          }
        }}
        onPaste={preventReadOnlyChange}
        onCut={preventReadOnlyChange}
        placeholder={text.placeholder}
        status={getStatus()}
        suffix={getSuffix()}
        size="large"
        readOnly={locked}
        autoComplete="off"
        spellCheck={false}
      />

      {scenario === 'demo' && !locked && (
        <Button
          block
          onClick={onSaveDemo}
          disabled={!isValid}
          icon={<LockOutlined />}
        >
          保存并锁定演示密钥
        </Button>
      )}

      {scenario === 'demo' && locked && (
        <div className="api-key-readonly-note">
          <LockOutlined />
          <span>当前为演示密钥，仅可查看；刷新或返回后仍保持只读，且不会被清空。</span>
        </div>
      )}

      {error && (
        <Text type="danger" className="input-error">
          {error}
        </Text>
      )}
      <Text type="secondary" className="input-hint">
        {locked ? '只读演示密钥不会被重置操作清空。' : text.hint}
      </Text>
    </div>
  );
}
