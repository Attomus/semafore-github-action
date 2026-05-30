import { readFileSync } from 'node:fs';

import {
  decryptMessage,
  generateEd25519KeyPair,
  generateIdentityKeyPair,
  generateOneTimePrekey,
  generateSignedPrekey,
  hexToBytes,
  initReceiverSession,
  publicOneTimePrekey,
  publicSignedPrekey
} from '@attomus/semafore-crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SemaForeClient } from '../src/client.js';
import type { NotifyInputs } from '../src/inputs.js';
import type { Logger } from '../src/logger.js';
import { runNotify } from '../src/notify.js';

const schema = JSON.parse(
  readFileSync(new URL('./fixtures/notify.send.request.schema.json', import.meta.url), 'utf8')
) as object;

const ajv = new Ajv2020();
const validateNotifySend = ajv.compile(schema);

describe('notify mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts rendered content with semafore-crypto and emits the ADR-0166 notify/send wire shape', async () => {
    vi.stubEnv('GITHUB_RUN_ID', 'run-123');
    vi.stubEnv('GITHUB_REF', 'refs/heads/main');

    const senderIdentity = generateIdentityKeyPair();
    const recipientIdentity = generateIdentityKeyPair();
    const recipientSigning = generateEd25519KeyPair();
    const recipientSignedPrekey = generateSignedPrekey(recipientSigning.secretKey, 'spk-current');
    const recipientOneTimePrekey = generateOneTimePrekey('opk-001');
    const plaintext = 'Deploy run-123 on refs/heads/main finished: SENTINEL-PLAINTEXT';
    const deviceKey = JSON.stringify({
      version: 1,
      identity_key_secret: encodeKey(senderIdentity.secretKey),
      identity_key_public: encodeKey(senderIdentity.publicKey)
    });

    let notifySendBody: unknown;
    const fetchImpl = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/integrations/notify/recipients') {
        return jsonResponse({
          recipients: [
            {
              recipient_user_id: '+447700900001',
              recipient_device_id: 'device-ios-1',
              key_bundle: {
                identity_key: encodeKey(recipientIdentity.publicKey),
                identity_signing_key: encodeKey(recipientSigning.publicKey),
                signed_pre_key: encodeSignedPrekey(recipientSignedPrekey),
                one_time_pre_key: encodeOneTimePrekey(recipientOneTimePrekey)
              }
            }
          ]
        });
      }
      if (path === '/api/integrations/notify/send') {
        notifySendBody = JSON.parse(String(init?.body));
        return jsonResponse({
          delivery_id: 'delivery-123',
          message_id: (notifySendBody as { message_id: string }).message_id,
          envelope_count: 1,
          status: 'accepted',
          accepted_at: '2026-05-30T13:00:00.000Z'
        });
      }
      throw new Error(`unexpected path ${path}`);
    });
    const client = new SemaForeClient({
      baseUrl: 'https://api.example.test',
      token: 'sem_token_value_that_is_long',
      fetchImpl
    });
    const logger = testLogger();

    await runNotify(
      {
        mode: 'notify',
        token: 'sem_token_value_that_is_long',
        deviceKey,
        target: { kind: 'org' },
        template: 'Deploy {{run_id}} on {{ref}} finished: SENTINEL-PLAINTEXT',
        apiBaseUrl: 'https://api.example.test'
      } satisfies NotifyInputs,
      client,
      logger
    );

    expect(validateNotifySend(notifySendBody)).toBe(true);
    expect(JSON.stringify(notifySendBody)).not.toContain('SENTINEL-PLAINTEXT');

    const request = notifySendBody as {
      message_id: string;
      envelopes: [{ dr_header: string; ciphertext: string }];
      metadata: { sender_kind: string; integration_kind: string; sender_display: string };
    };
    expect(request.metadata).toEqual({
      sender_kind: 'integration',
      integration_kind: 'github_action',
      sender_display: 'GitHub Actions'
    });
    expect(request.envelopes[0].dr_header).toMatch(/^(534d5831|534D5831)[0-9a-fA-F]+$/);

    const frame = concatBytes([
      hexToBytes(request.envelopes[0].dr_header),
      new Uint8Array(Buffer.from(request.envelopes[0].ciphertext, 'base64'))
    ]);
    const receiver = initReceiverSession({
      localIdentity: recipientIdentity,
      peerIdentityPublicKey: senderIdentity.publicKey,
      envelope: frame,
      signedPrekeyLookup: () => recipientSignedPrekey,
      oneTimePrekeyLookup: () => recipientOneTimePrekey
    });
    expect(new TextDecoder().decode(decryptMessage(receiver.session, frame))).toBe(plaintext);
    expect(logger.setOutput).toHaveBeenCalledWith('message_id', request.message_id);
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}

function testLogger(): Logger {
  return {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    setSecret: vi.fn(),
    setOutput: vi.fn()
  };
}

function encodeSignedPrekey(prekey: ReturnType<typeof generateSignedPrekey>): {
  key_id: string;
  public_key: string;
  signature: string;
} {
  const publicPrekey = publicSignedPrekey(prekey);
  return {
    key_id: publicPrekey.keyId,
    public_key: encodeKey(publicPrekey.publicKey),
    signature: encodeKey(publicPrekey.signature)
  };
}

function encodeOneTimePrekey(prekey: ReturnType<typeof generateOneTimePrekey>): {
  key_id: string;
  public_key: string;
} {
  const publicPrekey = publicOneTimePrekey(prekey);
  return {
    key_id: publicPrekey.keyId,
    public_key: encodeKey(publicPrekey.publicKey)
  };
}

function encodeKey(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
