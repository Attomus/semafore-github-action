export interface RepoSecretWriter {
  secretExists(name: string): Promise<boolean>;
  writeSecret(name: string, value: string): Promise<void>;
}

export class GitHubRepoSecretWriter implements RepoSecretWriter {
  private readonly owner: string;
  private readonly repo: string;

  constructor(githubToken: string) {
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
  }

  private readonly githubToken: string;

  async secretExists(name: string): Promise<boolean> {
    const response = await fetch(
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
    throw new Error(
      'GitHub secret writing is blocked until bootstrap depends on the published crypto package.'
    );
  }
}
