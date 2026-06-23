export interface SemaForeClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly retryDelayMs?: number;
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
  private static readonly defaultTimeoutMs = 10_000;
  private static readonly defaultMaxAttempts = 3;
  private static readonly defaultRetryDelayMs = 250;

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: SemaForeClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = positiveInteger(options.timeoutMs, SemaForeClient.defaultTimeoutMs);
    this.maxAttempts = positiveInteger(options.maxAttempts, SemaForeClient.defaultMaxAttempts);
    this.retryDelayMs = nonNegativeInteger(options.retryDelayMs, SemaForeClient.defaultRetryDelayMs);
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
    const url = new URL(path, this.options.baseUrl);
    const serializedBody = JSON.stringify(body);
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.token}`,
            'content-type': 'application/json',
            accept: 'application/json'
          },
          body: serializedBody,
          signal: AbortSignal.timeout(this.timeoutMs)
        });

        if (response.ok) {
          return (await response.json()) as T;
        }

        if (!shouldRetryStatus(response.status)) {
          throw new NonRetryableHttpError(`SemaFore API request failed with HTTP ${response.status}`);
        }
        if (attempt === this.maxAttempts) {
          throw new Error(`SemaFore API request failed with HTTP ${response.status}`);
        }
        lastError = new Error(`SemaFore API request failed with HTTP ${response.status}`);
      } catch (error: unknown) {
        if (error instanceof NonRetryableHttpError) {
          throw error;
        }
        lastError = error;
        if (attempt === this.maxAttempts) {
          break;
        }
      }

      await sleep(this.retryDelayMs * attempt);
    }

    throw new Error(`SemaFore API request failed: ${errorMessage(lastError)}`);
  }
}

function stringParam(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`params.${name} is required`);
  }
  return value;
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isInteger(value) || value <= 0 ? fallback : value;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isInteger(value) || value < 0 ? fallback : value;
}

async function sleep(ms: number): Promise<void> {
  if (ms === 0) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class NonRetryableHttpError extends Error {}
