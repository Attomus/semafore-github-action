import * as core from '@actions/core';

import { runBootstrap, githubToken } from './bootstrap.js';
import { SemaForeClient } from './client.js';
import { runExecute } from './execute.js';
import { parseInputs, readInputs } from './inputs.js';
import { actionLogger } from './logger.js';
import { runNotify } from './notify.js';
import { GitHubRepoSecretWriter } from './secrets.js';

export async function run(): Promise<void> {
  const inputs = readInputs(actionLogger);
  const client = new SemaForeClient({
    baseUrl: inputs.apiBaseUrl,
    token: inputs.token
  });

  switch (inputs.mode) {
    case 'bootstrap':
      await runBootstrap(inputs, client, new GitHubRepoSecretWriter(requiredGithubToken()), actionLogger);
      return;
    case 'notify':
      await runNotify(inputs, client, actionLogger);
      return;
    case 'execute':
      await runExecute(inputs, client, actionLogger);
      return;
  }
}

export { parseInputs };

function requiredGithubToken(): string {
  const token = githubToken();
  if (!token) {
    throw new Error('GITHUB_TOKEN with actions: write permission is required for bootstrap mode.');
  }
  core.setSecret(token);
  return token;
}

if (process.env.NODE_ENV !== 'test') {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
