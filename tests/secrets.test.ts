import sodium from 'libsodium-wrappers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubRepoSecretWriter } from '../src/secrets.js';

describe('GitHub repository secret writer', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_REPOSITORY', 'Attomus/example-repo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('seals a secret with the repository public key before writing it', async () => {
    await sodium.ready;
    const keyPair = sodium.crypto_box_keypair();
    const publicKey = sodium.to_base64(keyPair.publicKey, sodium.base64_variants.ORIGINAL);
    let writeBody: { encrypted_value: string; key_id: string } | undefined;
    const fetchImpl = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/actions/secrets/public-key')) {
        return response(200, { key: publicKey, key_id: 'github-key-123' });
      }
      if (path.endsWith('/actions/secrets/SEMAFORE_DEVICE_KEY') && init?.method === 'PUT') {
        writeBody = JSON.parse(String(init.body)) as { encrypted_value: string; key_id: string };
        return response(201);
      }
      throw new Error(`unexpected GitHub API request ${path}`);
    });
    const writer = new GitHubRepoSecretWriter('github-token-value', fetchImpl);

    await writer.writeSecret('SEMAFORE_DEVICE_KEY', 'private-device-state');

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/repos/Attomus/example-repo/actions/secrets/public-key'
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: { authorization: 'Bearer github-token-value' }
    });
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(
      'https://api.github.com/repos/Attomus/example-repo/actions/secrets/SEMAFORE_DEVICE_KEY'
    );
    expect(writeBody?.key_id).toBe('github-key-123');
    const decrypted = sodium.crypto_box_seal_open(
      sodium.from_base64(writeBody?.encrypted_value ?? '', sodium.base64_variants.ORIGINAL),
      keyPair.publicKey,
      keyPair.privateKey
    );
    expect(sodium.to_string(decrypted)).toBe('private-device-state');
    expect(JSON.stringify(writeBody)).not.toContain('private-device-state');
  });

  it('treats a missing repository secret as safe to create', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(404));
    const writer = new GitHubRepoSecretWriter('github-token-value', fetchImpl);

    await expect(writer.secretExists('SEMAFORE_DEVICE_KEY')).resolves.toBe(false);
  });

  it('fails closed when GitHub secret lookup is not authorised', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(403));
    const writer = new GitHubRepoSecretWriter('github-token-value', fetchImpl);

    await expect(writer.secretExists('SEMAFORE_DEVICE_KEY')).rejects.toThrow(
      'GitHub secret lookup failed with status 403.'
    );
  });

  it('rejects an invalid repository public-key response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, { key_id: 'github-key-123' }));
    const writer = new GitHubRepoSecretWriter('github-token-value', fetchImpl);

    await expect(writer.writeSecret('SEMAFORE_DEVICE_KEY', 'private-device-state')).rejects.toThrow(
      'GitHub secret public-key response is invalid.'
    );
  });
});

function response(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}
