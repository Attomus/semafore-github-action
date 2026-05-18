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
});
