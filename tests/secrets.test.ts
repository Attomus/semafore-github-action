import { afterEach, describe, expect, it, vi } from 'vitest';

import { GitHubRepoSecretWriter } from '../src/secrets.js';

describe('GitHub repo secret writer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GITHUB_REPOSITORY;
  });

  it('checks whether a repository secret already exists', async () => {
    process.env.GITHUB_REPOSITORY = 'Attomus/example';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
    vi.stubGlobal('fetch', fetchImpl);

    const writer = new GitHubRepoSecretWriter('github-token-value');

    await expect(writer.secretExists('SEMAFORE_DEVICE_KEY')).resolves.toBe(true);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/repos/Attomus/example/actions/secrets/SEMAFORE_DEVICE_KEY'
    );
  });

  it('returns false when a repository secret is absent', async () => {
    process.env.GITHUB_REPOSITORY = 'Attomus/example';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })
    );

    const writer = new GitHubRepoSecretWriter('github-token-value');

    await expect(writer.secretExists('SEMAFORE_DEVICE_KEY')).resolves.toBe(false);
  });

  it('fetches the repository public key used for secret encryption', async () => {
    process.env.GITHUB_REPOSITORY = 'Attomus/example';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key_id: 'key-123', key: 'base64-public-key' })
    });
    vi.stubGlobal('fetch', fetchImpl);

    const writer = new GitHubRepoSecretWriter('github-token-value');

    await expect(writer.fetchPublicKey()).resolves.toEqual({
      key_id: 'key-123',
      key: 'base64-public-key'
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/repos/Attomus/example/actions/secrets/public-key'
    );
  });

  it('rejects malformed public-key responses', async () => {
    process.env.GITHUB_REPOSITORY = 'Attomus/example';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ key_id: 'key-123' })
      })
    );

    const writer = new GitHubRepoSecretWriter('github-token-value');

    await expect(writer.fetchPublicKey()).rejects.toThrow('missing key_id or key');
  });
});
