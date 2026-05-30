export interface SemaForeClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
}

export interface ExecuteRequest {
  readonly action: 'create_thread' | 'archive_thread' | 'audit_event';
  readonly params: Record<string, unknown>;
}

export interface NotifyTargetRequest {
  readonly target: {
    readonly kind: 'org' | 'group' | 'user';
    readonly id?: string;
  };
}

export interface NotifyRecipientDevice {
  readonly recipient_user_id: string;
  readonly recipient_device_id: string;
  readonly key_bundle: RecipientKeyBundle;
}

export interface RecipientKeyBundle {
  readonly identity_key: string;
  readonly identity_signing_key: string;
  readonly signed_pre_key: {
    readonly key_id: string;
    readonly public_key: string;
    readonly signature: string;
  };
  readonly one_time_pre_key?: {
    readonly key_id: string;
    readonly public_key: string;
  } | null;
}

export interface NotifyRecipientResponse {
  readonly recipients: NotifyRecipientDevice[];
}

export interface NotifySendEnvelope {
  readonly recipient_user_id: string;
  readonly recipient_device_id: string;
  readonly ciphertext: string;
  readonly dr_header: string;
}

export interface NotifySendRequest {
  readonly message_id: string;
  readonly envelopes: NotifySendEnvelope[];
  readonly metadata: {
    readonly sender_kind: 'integration';
    readonly integration_kind: 'github_action';
    readonly sender_display?: string;
  };
}

export interface NotifySendResponse {
  readonly delivery_id: string;
  readonly message_id: string;
  readonly envelope_count: number;
  readonly status: 'accepted' | 'duplicate';
  readonly accepted_at: string;
  readonly prior_delivery_id?: string;
}

export class SemaForeClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SemaForeClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async registerDevice(_request: unknown): Promise<{ device_id: string }> {
    return this.postJson('/api/integrations/bootstrap/device/register', _request);
  }

  async listNotifyRecipients(request: NotifyTargetRequest): Promise<NotifyRecipientResponse> {
    return this.postJson('/api/integrations/notify/recipients', request);
  }

  async sendNotification(request: NotifySendRequest): Promise<NotifySendResponse> {
    return this.postJson('/api/integrations/notify/send', request);
  }

  async execute(request: ExecuteRequest): Promise<Record<string, unknown>> {
    switch (request.action) {
      case 'create_thread':
        return this.postJson('/api/integrations/execute/thread/create', request.params);
      case 'archive_thread': {
        const threadId = stringParam(request.params, 'thread_id');
        return this.postJson(`/api/integrations/execute/thread/archive/${encodeURIComponent(threadId)}`, request.params);
      }
      case 'audit_event':
        return this.postJson('/api/integrations/execute/audit/event', request.params);
    }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(new URL(path, this.options.baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.token}`,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`SemaFore API request failed with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

function stringParam(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`params.${name} is required`);
  }
  return value;
}
