import * as github from '@actions/github';
import sodium from 'libsodium-wrappers';

export interface RepoSecretWriter {
  secretExists(name: string): Promise<boolean>;
  writeSecret(name: string, value: string): Promise<void>;
}

export class GitHubRepoSecretWriter implements RepoSecretWriter {
  private readonly octokit: ReturnType<typeof github.getOctokit>;
  private readonly owner: string;
  private readonly repo: string;

  constructor(githubToken: string) {
    this.octokit = github.getOctokit(githubToken);
    this.owner = github.context.repo.owner;
    this.repo = github.context.repo.repo;
  }

  async secretExists(name: string): Promise<boolean> {
    try {
      await this.octokit.rest.actions.getRepoSecret({
        owner: this.owner,
        repo: this.repo,
        secret_name: name
      });
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async writeSecret(name: string, value: string): Promise<void> {
    const publicKey = await this.octokit.rest.actions.getRepoPublicKey({
      owner: this.owner,
      repo: this.repo
    });
    const encrypted = await encryptRepoSecret(value, publicKey.data.key);
    await this.octokit.rest.actions.createOrUpdateRepoSecret({
      owner: this.owner,
      repo: this.repo,
      secret_name: name,
      encrypted_value: encrypted,
      key_id: publicKey.data.key_id
    });
  }
}

export async function encryptRepoSecret(value: string, base64PublicKey: string): Promise<string> {
  await sodium.ready;
  const keyBytes = sodium.from_base64(base64PublicKey, sodium.base64_variants.ORIGINAL);
  const valueBytes = sodium.from_string(value);
  const encryptedBytes = sodium.crypto_box_seal(valueBytes, keyBytes);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 404
  );
}
