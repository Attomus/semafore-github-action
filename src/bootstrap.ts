import * as core from '@actions/core';

import type { SemaForeClient } from './client.js';
import type { BootstrapInputs } from './inputs.js';
import type { Logger } from './logger.js';
import type { RepoSecretWriter } from './secrets.js';

export async function runBootstrap(
  inputs: BootstrapInputs,
  client: SemaForeClient,
  secretWriter: RepoSecretWriter,
  logger: Logger
): Promise<void> {
  logger.setSecret(inputs.token);

  if (await secretWriter.secretExists('SEMAFORE_DEVICE_KEY')) {
    throw new Error('SEMAFORE_DEVICE_KEY already exists. Revoke the existing SemaFore device before re-bootstrap.');
  }

  throw new Error(
    'Bootstrap is scaffolded but blocked until @attomus/semafore-crypto is published and the staging bootstrap endpoint is live.'
  );
}

export function githubToken(): string {
  return core.getInput('github_token') || process.env.GITHUB_TOKEN || '';
}
