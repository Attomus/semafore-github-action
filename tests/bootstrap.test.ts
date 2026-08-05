import { readFileSync } from 'node:fs';

import { ed25519Verify } from '@attomus/semafore-crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { githubToken, runBootstrap } from '../src/bootstrap.js';
import { SemaForeClient, type BootstrapDeviceRegisterRequest } from '../src/client.js';
import type { BootstrapInputs } from '../src/inputs.js';
import type { Logger } from '../src/logger.js';
import type { RepoSecretWriter } from '../src/secrets.js';

const schema = JSON.parse(
  readFileSync(new URL('./fixtures/bootstrap.device.register.request.schema.json', import.meta.url), 'utf8')
) as object;

const validateRegisterRequest = new Ajv2020().compile(schema);

describe('bootstrap mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers a generated public bundle and stores the matching private device state', async () => {
    vi.stubEnv('GITHUB_REPOSITORY', 'Attomus/example-repo');
    let registerRequest: BootstrapDeviceRegisterRequest | undefined;
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      registerRequest = JSON.parse(String(init?.body)) as BootstrapDeviceRegisterRequest;
      return jsonResponse({
        device_id: 'int-device-123',
        registered_at: '2026-08-05T12:00:00Z',
        expires_at: null
      });
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_bootstrap_token_value_that_is_long',
      fetchImpl
    });
    const secretWriter = testSecretWriter(false);
    const logger = testLogger();

    await runBootstrap(bootstrapInputs(), client, secretWriter, logger);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(validateRegisterRequest(registerRequest)).toBe(true);
    expect(registerRequest).toMatchObject({
      device_kind: 'integration_github_action',
      display_name: 'GitHub Actions: Attomus/example-repo'
    });
    expect(registerRequest?.one_time_prekeys).toHaveLength(100);

    expect(secretWriter.writeSecret).toHaveBeenCalledTimes(1);
    const [secretName, encodedDeviceKey] = secretWriter.writeSecret.mock.calls[0] as [string, string];
    expect(secretName).toBe('SEMAFORE_DEVICE_KEY');
    const deviceKey = JSON.parse(encodedDeviceKey) as EncodedBootstrapDeviceKey;
    expect(deviceKey).toMatchObject({
      version: 1,
      device_id: 'int-device-123',
      device_kind: 'integration_github_action',
      sessions: {}
    });
    expect(deviceKey.identity_key_public).toBe(registerRequest?.identity_key_pub);
    expect(deviceKey.signed_pre_key.public_key).toBe(registerRequest?.signed_prekey.key_pub);
    expect(deviceKey.signed_pre_key.signature).toBe(registerRequest?.signed_prekey.signature);
    expect(deviceKey.one_time_pre_keys).toHaveLength(100);
    expect(deviceKey.one_time_pre_keys[0]?.public_key).toBe(registerRequest?.one_time_prekeys[0]?.key_pub);
    expect(
      ed25519Verify(
        decodeKey(deviceKey.signed_pre_key.signature),
        decodeKey(deviceKey.signed_pre_key.public_key),
        decodeKey(deviceKey.identity_signing_key_public)
      )
    ).toBe(true);
    expect(encodedDeviceKey).not.toContain('sem_bootstrap_token_value_that_is_long');
    expect(Buffer.byteLength(encodedDeviceKey, 'utf8')).toBeLessThan(48 * 1024);
    expect(logger.setSecret).toHaveBeenCalledWith(encodedDeviceKey);
    expect(logger.setOutput).toHaveBeenCalledWith('device_id', 'int-device-123');
    expect(logger.info).toHaveBeenCalledWith(
      'SemaFore device registered. You can now remove the bootstrap step from your workflow.'
    );
  });

  it('refuses to overwrite an existing device secret before registering another device', async () => {
    const fetchImpl = vi.fn();
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_bootstrap_token_value_that_is_long',
      fetchImpl
    });
    const secretWriter = testSecretWriter(true);

    await expect(runBootstrap(bootstrapInputs(), client, secretWriter, testLogger())).rejects.toThrow(
      'SEMAFORE_DEVICE_KEY already exists'
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(secretWriter.writeSecret).not.toHaveBeenCalled();
  });

  it('reports the registered device when GitHub secret storage fails', async () => {
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_bootstrap_token_value_that_is_long',
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({
          device_id: 'int-device-orphaned',
          registered_at: '2026-08-05T12:00:00Z',
          expires_at: null
        })
      )
    });
    const secretWriter = testSecretWriter(false);
    secretWriter.writeSecret.mockRejectedValue(new Error('GitHub secret write failed with status 403.'));

    await expect(runBootstrap(bootstrapInputs(), client, secretWriter, testLogger())).rejects.toThrow(
      'SemaFore device int-device-orphaned was registered, but writing SEMAFORE_DEVICE_KEY failed. '
    );
  });

  it('does not mistake the built-in GITHUB_TOKEN for a repository Secrets token', () => {
    vi.stubEnv('GITHUB_TOKEN', 'built-in-workflow-token');
    vi.stubEnv('INPUT_GITHUB_TOKEN', '');

    expect(githubToken()).toBe('');
  });
});

interface EncodedBootstrapDeviceKey {
  readonly version: number;
  readonly device_id: string;
  readonly device_kind: string;
  readonly identity_key_public: string;
  readonly identity_signing_key_public: string;
  readonly signed_pre_key: {
    readonly public_key: string;
    readonly signature: string;
  };
  readonly one_time_pre_keys: Array<{ readonly public_key: string }>;
  readonly sessions: Record<string, unknown>;
}

function bootstrapInputs(): BootstrapInputs {
  return {
    mode: 'bootstrap',
    token: 'sem_bootstrap_token_value_that_is_long',
    apiBaseUrl: 'https://api.example.test'
  };
}

function testSecretWriter(exists: boolean): RepoSecretWriter & {
  secretExists: ReturnType<typeof vi.fn>;
  writeSecret: ReturnType<typeof vi.fn>;
} {
  return {
    secretExists: vi.fn().mockResolvedValue(exists),
    writeSecret: vi.fn().mockResolvedValue(undefined)
  };
}

function testLogger() {
  return {
    info: vi.fn<(message: string) => void>(),
    warning: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>(),
    setSecret: vi.fn<(value: string) => void>(),
    setOutput: vi.fn<(name: string, value: string) => void>()
  } satisfies Logger;
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 201,
    json: async () => body
  } as Response;
}

function decodeKey(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}
