import { useState } from 'react';
import { Input, Button, Space, Tag, Typography } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined, CloseCircleOutlined, LockOutlined } from '@ant-design/icons';
import type { APIKeyScope } from '../../types';
import { API_KEY_SCOPE_LABELS } from '../../types';
import { validateAPIKey } from '../../utils/validators';
import './APIKeyInput.css';

const { Text } = Typography;

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** 当前密钥归属（自用 / 演示） */
  scope: APIKeyScope;
  /** 只读模式（演示密钥锁定后仅可查看，不能改动也不能清空） */
  readOnly?: boolean;
}

/**
 * API 密钥输入组件
 */
export function APIKeyInput({ value, onChange, error, scope, readOnly = false }: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const isValid = validateAPIKey(value);
  const scopeLabel = API_KEY_SCOPE_LABELS[scope];

  const toggleVisibility = () => {
    setVisible(!visible);
  };

  const getStatus = (): "" | "error" | "warning" | undefined => {
    if (!value) return undefined;
    return isValid ? "" : 'error';
  };

  const getSuffix = () => {
    if (!value) return null;

    return (
      <Space>
        {isValid ? (
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
        ) : (
          <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />
        )}
        <Button
          type="text"
          size="small"
          icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={toggleVisibility}
        />
      </Space>
    );
  };

  const getScopeTag = () => {
    if (scope === 'demo') {
      return readOnly ? (
        <Tag icon={<LockOutlined />} color="orange" className="scope-tag">演示 · 只读</Tag>
      ) : (
        <Tag color="gold" className="scope-tag">演示 · 待锁定</Tag>
      );
    }
    return <Tag color="green" className="scope-tag">自用 · 可编辑</Tag>;
  };

  const getHint = () => {
    if (scope === 'demo') {
      return readOnly
        ? '演示密钥已锁定，仅可查看，不能改动也不能清空'
        : '请填写演示用 API Key，保存并锁定后仅可查看';
    }
    return '从 SiliconFlow 控制台获取 API Key';
  };

  return (
    <div className="api-key-input">
      <div className="input-label-row">
        <label className="input-label">API Key</label>
        {getScopeTag()}
      </div>
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={scope === 'demo' ? '请输入演示用 API Key' : '请输入 SiliconFlow API Key'}
        status={getStatus()}
        suffix={getSuffix()}
        addonBefore={<span className="scope-addon">{scopeLabel}密钥</span>}
        disabled={readOnly}
        size="large"
      />
      {error && (
        <Text type="danger" className="input-error">
          {error}
        </Text>
      )}
      <Text type="secondary" className="input-hint">
        {getHint()}
      </Text>
    </div>
  );
}
