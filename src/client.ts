export interface SemaForeClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
}

export interface ExecuteRequest {
  readonly action: 'create_thread' | 'archive_thread' | 'audit_event';
  readonly params: Record<string, unknown>;
}

export interface NotifyRequest {
  readonly target: unknown;
  readonly severity?: string;
  readonly metadata: {
    readonly bodyLength: number;
  };
  readonly envelopes: unknown[];
}

export class SemaForeClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SemaForeClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async registerDevice(_request: unknown): Promise<{ device_id: string }> {
    return this.postJson('/api/integrations/bootstrap/device/register', _request);
  }

  async sendNotification(request: NotifyRequest): Promise<{ message_id?: string }> {
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
