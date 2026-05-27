import { describe, expect, it, vi } from 'vitest';

import { SemaForeClient } from '../src/client.js';

describe('SemaFore client', () => {
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

  it('posts notify envelopes to the integration notify endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: 'msg-123' })
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_token_value_that_is_long',
      fetchImpl
    });

    await expect(
      client.sendNotification({
        target: { kind: 'org' },
        metadata: { bodyLength: 12 },
        envelopes: [{ recipient_device_id: 'device-1', header: 'SMX1', ciphertext: 'abc' }]
      })
    ).resolves.toEqual({ message_id: 'msg-123' });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://api.example.test/api/integrations/notify/send'
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        target: { kind: 'org' },
        metadata: { bodyLength: 12 },
        envelopes: [{ recipient_device_id: 'device-1', header: 'SMX1', ciphertext: 'abc' }]
      })
    });
  });
});
