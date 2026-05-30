import { randomUUID } from 'node:crypto';

import type { SemaForeClient } from './client.js';
import { encryptNotifyEnvelope } from './crypto.js';
import type { NotifyInputs } from './inputs.js';
import type { Logger } from './logger.js';
import { githubContextFromEnv, renderTemplate } from './templater.js';

export async function runNotify(inputs: NotifyInputs, client: SemaForeClient, logger: Logger): Promise<void> {
  logger.setSecret(inputs.token);
  logger.setSecret(inputs.deviceKey);

  const body = renderTemplate(inputs.template, githubContextFromEnv());
  const recipients = await client.listNotifyRecipients({ target: notifyTargetRequest(inputs) });
  if (recipients.recipients.length === 0) {
    throw new Error('notify target resolved to zero recipient devices.');
  }

  const request = {
    message_id: randomUUID(),
    envelopes: recipients.recipients.map((recipient) => encryptNotifyEnvelope(inputs.deviceKey, recipient, body)),
    metadata: {
      sender_kind: 'integration' as const,
      integration_kind: 'github_action' as const,
      sender_display: 'GitHub Actions'
    }
  };

  const response = await client.sendNotification(request);
  logger.setOutput('message_id', response.message_id);
}

function notifyTargetRequest(inputs: NotifyInputs): { kind: 'org' | 'group' | 'user'; id?: string } {
  switch (inputs.target.kind) {
    case 'org':
      return { kind: 'org' };
    case 'group':
      return { kind: 'group', id: inputs.target.id };
    case 'user':
      return { kind: 'user', id: inputs.target.id };
  }
}
