import sodium from 'libsodium-wrappers';

export interface RepoSecretWriter {
  secretExists(name: string): Promise<boolean>;
  writeSecret(name: string, value: string): Promise<void>;
}

export class GitHubRepoSecretWriter implements RepoSecretWriter {
  private readonly owner: string;
  private readonly repo: string;
  private readonly fetchImpl: typeof fetch;

  constructor(githubToken: string, fetchImpl: typeof fetch = fetch) {
    const repoSlug = process.env.GITHUB_REPOSITORY;
    if (!repoSlug) {
      throw new Error('GITHUB_REPOSITORY is required for bootstrap mode.');
    }

    const [owner, repo] = repoSlug.split('/');
    if (!owner || !repo) {
      throw new Error('GITHUB_REPOSITORY must be in owner/repo form.');
    }

    this.owner = owner;
    this.repo = repo;
    this.githubToken = githubToken;
    this.fetchImpl = fetchImpl;
  }

  private readonly githubToken: string;

  async secretExists(name: string): Promise<boolean> {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
        this.repo
      )}/actions/secrets/${encodeURIComponent(name)}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${this.githubToken}`,
          'x-github-api-version': '2022-11-28'
        }
      }
    );

    if (response.ok) {
      return true;
    }

    if (response.status === 404) {
      return false;
    }

    throw new Error(`GitHub secret lookup failed with status ${response.status}.`);
  }

  async writeSecret(name: string, value: string): Promise<void> {
    if (!name.trim() || !value.trim()) {
      throw new Error('secret name and value are required');
    }

    const publicKeyResponse = await this.fetchImpl(this.repoApiUrl('/actions/secrets/public-key'), {
      headers: this.headers()
    });
    if (!publicKeyResponse.ok) {
      throw new Error(`GitHub secret public-key lookup failed with status ${publicKeyResponse.status}.`);
    }
    const publicKey = (await publicKeyResponse.json()) as { key?: unknown; key_id?: unknown };
    if (typeof publicKey.key !== 'string' || typeof publicKey.key_id !== 'string') {
      throw new Error('GitHub secret public-key response is invalid.');
    }

    const encryptedValue = await encryptRepoSecret(value, publicKey.key);
    const writeResponse = await this.fetchImpl(
      this.repoApiUrl(`/actions/secrets/${encodeURIComponent(name)}`),
      {
        method: 'PUT',
        headers: {
          ...this.headers(),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          encrypted_value: encryptedValue,
          key_id: publicKey.key_id
        })
      }
    );
    if (!writeResponse.ok) {
      throw new Error(`GitHub secret write failed with status ${writeResponse.status}.`);
    }
  }

  private repoApiUrl(path: string): string {
    return `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${path}`;
  }

  private headers(): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${this.githubToken}`,
      'x-github-api-version': '2022-11-28'
    };
  }
}

export async function encryptRepoSecret(value: string, base64PublicKey: string): Promise<string> {
  await sodium.ready;
  const publicKey = sodium.from_base64(base64PublicKey, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.crypto_box_seal(sodium.from_string(value), publicKey);
  return sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL);
}
