import type { SemaForeClient } from './client.js';
import type { NotifyInputs } from './inputs.js';
import type { Logger } from './logger.js';
import { githubContextFromEnv, renderTemplate } from './templater.js';

export async function runNotify(inputs: NotifyInputs, client: SemaForeClient, logger: Logger): Promise<void> {
  logger.setSecret(inputs.token);
  logger.setSecret(inputs.deviceKey);

  const body = renderTemplate(inputs.template, githubContextFromEnv());

  throw new Error(
    `Notify is scaffolded but blocked until @attomus/semafore-crypto is published and integration recipient endpoints are live. Rendered body length: ${body.length}. Client ready: ${Boolean(client)}.`
  );
}
