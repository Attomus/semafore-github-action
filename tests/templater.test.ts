import { describe, expect, it } from 'vitest';

import { renderTemplate } from '../src/templater.js';

describe('templater', () => {
  it('renders SemaFore shorthand placeholders', () => {
    expect(
      renderTemplate('Run {{run_id}} on {{ref}} by {{actor}}', {
        runId: '123',
        ref: 'refs/heads/main',
        actor: 'steve'
      })
    ).toBe('Run 123 on refs/heads/main by steve');
  });
});
