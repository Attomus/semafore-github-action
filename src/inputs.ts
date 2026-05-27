import * as core from '@actions/core';

import type { Logger } from './logger.js';

export type Mode = 'notify' | 'execute' | 'bootstrap';
export type ExecuteAction = 'create_thread' | 'archive_thread' | 'audit_event';
export type NotifyTarget =
  | { kind: 'org' }
  | { kind: 'group'; id: string }
  | { kind: 'user'; id: string };

export interface NotifyInputs {
  readonly mode: 'notify';
  readonly token: string;
  readonly deviceKey: string;
  readonly target: NotifyTarget;
  readonly template: string;
  readonly severity?: string;
  readonly apiBaseUrl: string;
}

export interface ExecuteInputs {
  readonly mode: 'execute';
  readonly token: string;
  readonly action: ExecuteAction;
  readonly params: Record<string, unknown>;
  readonly apiBaseUrl: string;
}

export interface BootstrapInputs {
  readonly mode: 'bootstrap';
  readonly token: string;
  readonly apiBaseUrl: string;
}

export type ActionInputs = NotifyInputs | ExecuteInputs | BootstrapInputs;

const DEFAULT_API_BASE_URL = 'https://api.semafore.io';
const MODES = new Set<Mode>(['notify', 'execute', 'bootstrap']);
const EXECUTE_ACTIONS = new Set<ExecuteAction>([
  'create_thread',
  'archive_thread',
  'audit_event'
]);

export interface RawInputs {
  readonly token?: string | undefined;
  readonly bootstrapToken?: string | undefined;
  readonly deviceKey?: string | undefined;
  readonly mode?: string | undefined;
  readonly target?: string | undefined;
  readonly template?: string | undefined;
  readonly action?: string | undefined;
  readonly params?: string | undefined;
  readonly severity?: string | undefined;
  readonly apiBaseUrl?: string | undefined;
  readonly allowUnsafeSecretInputs?: boolean | undefined;
}

export function readInputs(logger: Logger = coreLogger): ActionInputs {
  return parseInputs(
    {
      token: core.getInput('token'),
      bootstrapToken: core.getInput('bootstrap_token'),
      deviceKey: core.getInput('device_key'),
      mode: core.getInput('mode') || inferModeFromActionPath(),
      target: core.getInput('target'),
      template: core.getInput('template'),
      action: core.getInput('action'),
      params: core.getInput('params'),
      severity: core.getInput('severity'),
      apiBaseUrl: core.getInput('api_base_url') || process.env.SEMAFORE_API_BASE_URL
    },
    logger
  );
}

export function parseInputs(raw: RawInputs, logger: Logger = coreLogger): ActionInputs {
  const mode = normalizeMode(raw.mode);
  const apiBaseUrl = normalizeApiBaseUrl(raw.apiBaseUrl);
  const token = mode === 'bootstrap' ? required(raw.bootstrapToken ?? raw.token, 'bootstrap_token') : required(raw.token, 'token');
  protectSensitiveInput(token, 'SEMAFORE_TOKEN', logger, raw.allowUnsafeSecretInputs === true);

  if (mode === 'bootstrap') {
    return { mode, token, apiBaseUrl };
  }

  if (mode === 'notify') {
    const deviceKey = required(raw.deviceKey, 'device_key');
    protectSensitiveInput(deviceKey, 'SEMAFORE_DEVICE_KEY', logger, raw.allowUnsafeSecretInputs === true);
    const notify: NotifyInputs = {
      mode,
      token,
      deviceKey,
      target: parseNotifyTarget(required(raw.target, 'target')),
      template: required(raw.template, 'template'),
      apiBaseUrl
    };
    const severity = optionalNonEmpty(raw.severity);
    return severity === undefined ? notify : { ...notify, severity };
  }

  return {
    mode,
    token,
    action: parseExecuteAction(required(raw.action, 'action')),
    params: parseParams(raw.params),
    apiBaseUrl
  };
}

function normalizeMode(value?: string): Mode {
  const mode = (value?.trim() || 'notify') as Mode;
  if (!MODES.has(mode)) {
    throw new Error(`mode must be one of: ${Array.from(MODES).join(', ')}`);
  }
  return mode;
}

function normalizeApiBaseUrl(value?: string): string {
  const raw = value?.trim() || DEFAULT_API_BASE_URL;
  const url = new URL(raw);
  if (url.protocol !== 'https:' && process.env.NODE_ENV !== 'test') {
    throw new Error('api_base_url must use https');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

function parseNotifyTarget(value: string): NotifyTarget {
  if (value === 'org') {
    return { kind: 'org' };
  }
  const [kind, id, extra] = value.split(':');
  if (extra !== undefined || !id?.trim()) {
    throw new Error('target must be org, group:<id>, or user:<id>');
  }
  if (kind === 'group' || kind === 'user') {
    return { kind, id: id.trim() };
  }
  throw new Error('target must be org, group:<id>, or user:<id>');
}

function parseExecuteAction(value: string): ExecuteAction {
  const action = value.trim() as ExecuteAction;
  if (!EXECUTE_ACTIONS.has(action)) {
    throw new Error(`action must be one of: ${Array.from(EXECUTE_ACTIONS).join(', ')}`);
  }
  return action;
}

function parseParams(value?: string): Record<string, unknown> {
  if (!value?.trim()) {
    return {};
  }
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('params must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function optionalNonEmpty(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function protectSensitiveInput(value: string, label: string, logger: Logger, allowUnsafeSecretInputs: boolean): void {
  logger.setSecret(value);
  if (allowUnsafeSecretInputs) {
    return;
  }
  if (looksLikeUnsafeLiteral(value)) {
    throw new Error(
      'SEMAFORE_TOKEN and SEMAFORE_DEVICE_KEY must be stored as GitHub Actions secrets, not literals or variables.'
    );
  }
  if (process.env.GITHUB_ACTIONS === 'true' && value.length < 20) {
    throw new Error(`${label} is too short to be a valid secret value.`);
  }
}

function looksLikeUnsafeLiteral(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.startsWith('${{') ||
    normalized.includes('replace-me') ||
    normalized.includes('changeme') ||
    normalized.includes('example') ||
    normalized.includes('not-a-secret') ||
    normalized.includes('paste-token-here') ||
    normalized.includes('literal') ||
    normalized === 'token' ||
    normalized === 'device_key' ||
    normalized === 'semafore_token' ||
    normalized === 'semafore_device_key'
  );
}

function inferModeFromActionPath(): Mode {
  const actionPath = process.env.GITHUB_ACTION_PATH ?? '';
  return actionPath.endsWith('/bootstrap') ? 'bootstrap' : 'notify';
}

const coreLogger: Logger = {
  info: core.info,
  warning: core.warning,
  error: core.error,
  setSecret: core.setSecret,
  setOutput: core.setOutput
};
