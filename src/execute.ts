import type { SemaForeClient } from './client.js';
import type { ExecuteInputs } from './inputs.js';
import type { Logger } from './logger.js';

export async function runExecute(inputs: ExecuteInputs, client: SemaForeClient, logger: Logger): Promise<void> {
  logger.setSecret(inputs.token);
  const result = await client.execute({
    action: inputs.action,
    params: inputs.params
  });
  logger.setOutput('result', JSON.stringify(result));
}
