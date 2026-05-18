import { describe, expect, it, vi } from 'vitest';

import { parseInputs } from '../src/inputs.js';
import type { Logger } from '../src/logger.js';

const logger: Logger = {
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setSecret: vi.fn(),
  setOutput: vi.fn()
};

describe('input parsing', () => {
  it('parses notify inputs', () => {
    const parsed = parseInputs(
      {
        mode: 'notify',
        token: 'sem_token_value_that_is_long',
        deviceKey: 'sem_device_key_value_that_is_long',
        target: 'group:engineering',
        template: 'Build {{run_id}} failed',
        severity: 'high',
        apiBaseUrl: 'https://api.example.test'
      },
      logger
    );

    expect(parsed).toMatchObject({
      mode: 'notify',
      target: { kind: 'group', id: 'engineering' },
      severity: 'high',
      apiBaseUrl: 'https://api.example.test'
    });
    expect(logger.setSecret).toHaveBeenCalledWith('sem_token_value_that_is_long');
    expect(logger.setSecret).toHaveBeenCalledWith('sem_device_key_value_that_is_long');
  });

  it('rejects literal-looking secrets', () => {
    expect(() =>
      parseInputs(
        {
          mode: 'notify',
          token: 'replace-me',
          deviceKey: 'sem_device_key_value_that_is_long',
          target: 'org',
          template: 'Hello'
        },
        logger
      )
    ).toThrow('must be stored as GitHub Actions secrets');
  });

  it('validates execute params as an object', () => {
    const parsed = parseInputs(
      {
        mode: 'execute',
        token: 'sem_token_value_that_is_long',
        action: 'archive_thread',
        params: '{"thread_id":"thread-123"}'
      },
      logger
    );

    expect(parsed).toMatchObject({
      mode: 'execute',
      action: 'archive_thread',
      params: { thread_id: 'thread-123' }
    });
  });

  it('parses bootstrap token input', () => {
    const parsed = parseInputs(
      {
        mode: 'bootstrap',
        bootstrapToken: 'sem_bootstrap_token_value_that_is_long'
      },
      logger
    );

    expect(parsed).toMatchObject({
      mode: 'bootstrap',
      token: 'sem_bootstrap_token_value_that_is_long'
    });
  });
});
