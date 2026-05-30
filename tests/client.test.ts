import { describe, expect, it, vi } from 'vitest';

import { SemaForeClient } from '../src/client.js';

describe('SemaFore client', () => {
  it('routes create_thread execute requests to the thread creation endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ thread_id: 'thread-123' })
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_token_value_that_is_long',
      fetchImpl
    });

    await expect(
      client.execute({
        action: 'create_thread',
        params: { title_ciphertext: 'ciphertext' }
      })
    ).resolves.toEqual({ thread_id: 'thread-123' });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.example.test/api/integrations/execute/thread/create'
    );
  });

  it('routes archive_thread execute requests to the thread archive endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: true })
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_token_value_that_is_long',
      fetchImpl
    });

    await expect(
      client.execute({
        action: 'archive_thread',
        params: { thread_id: 'thread-123' }
      })
    ).resolves.toEqual({ archived: true });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.example.test/api/integrations/execute/thread/archive/thread-123'
    );
  });

  it('routes audit_event execute requests to the audit event endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ event_id: 'event-123' })
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_token_value_that_is_long',
      fetchImpl
    });

    await expect(
      client.execute({
        action: 'audit_event',
        params: { event_kind: 'workflow.completed', github_context: { run_id: 'run-123' } }
      })
    ).resolves.toEqual({ event_id: 'event-123' });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.example.test/api/integrations/execute/audit/event'
    );
  });

  it('fetches notify recipients from the integration notify recipient endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recipients: [] })
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_token_value_that_is_long',
      fetchImpl
    });

    await expect(client.listNotifyRecipients({ target: { kind: 'org' } })).resolves.toEqual({ recipients: [] });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.example.test/api/integrations/notify/recipients'
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ target: { kind: 'org' } })
    });
  });
});
