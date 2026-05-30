import {
  bytesToHex,
  encryptMessage,
  initSenderSession,
  type IdentityKeyPair,
  type KeyBundle,
  type KeyPair,
  type SessionState,
  x25519PublicKey
} from '@attomus/semafore-crypto';

import type { NotifyRecipientDevice, NotifySendEnvelope } from './client.js';

export interface EncodedDeviceKey {
  readonly version?: number;
  readonly identity_key_secret?: string;
  readonly identity_key_public?: string;
  readonly identitySecretKey?: string;
  readonly identityPublicKey?: string;
  readonly sessions?: Record<string, EncodedSessionState>;
}

interface EncodedSessionState {
  readonly root_key: string;
  readonly local_ratchet_public_key: string;
  readonly local_ratchet_secret_key: string;
  readonly remote_ratchet_public_key?: string;
  readonly sending_chain_key?: string;
  readonly receiving_chain_key?: string;
  readonly sending_message_number?: number;
  readonly receiving_message_number?: number;
  readonly previous_sending_chain_length?: number;
  readonly skipped_message_keys?: EncodedSkippedMessageKey[];
  readonly pending_prekey?: {
    readonly signed_prekey_id: string;
    readonly one_time_prekey_id?: string;
  };
  readonly max_skipped_message_keys?: number;
}

interface EncodedSkippedMessageKey {
  readonly ratchet_public_key_hex: string;
  readonly message_number: number;
  readonly message_key: string;
}

export function encryptNotifyEnvelope(
  deviceKeyInput: string,
  recipient: NotifyRecipientDevice,
  plaintext: string
): NotifySendEnvelope {
  const deviceKey = parseDeviceKey(deviceKeyInput);
  const session = sessionForRecipient(deviceKey, recipient);
  const envelope = encryptMessage(session, plaintext);

  return {
    recipient_user_id: recipient.recipient_user_id,
    recipient_device_id: recipient.recipient_device_id,
    ciphertext: Buffer.from(envelope.ciphertext).toString('base64'),
    dr_header: bytesToHex(envelope.headerBytes)
  };
}

function sessionForRecipient(deviceKey: EncodedDeviceKey, recipient: NotifyRecipientDevice): SessionState {
  const sessionKey = `${recipient.recipient_user_id}:${recipient.recipient_device_id}`;
  const existing = deviceKey.sessions?.[sessionKey];
  if (existing !== undefined) {
    return decodeSessionState(existing);
  }

  return initSenderSession({
    localIdentity: localIdentityFromDeviceKey(deviceKey),
    recipientBundle: keyBundleFromRecipient(recipient)
  });
}

function localIdentityFromDeviceKey(deviceKey: EncodedDeviceKey): IdentityKeyPair {
  const secret = requiredString(
    deviceKey.identity_key_secret ?? deviceKey.identitySecretKey,
    'device_key.identity_key_secret'
  );
  const secretKey = decodeKeyBytes(secret, 'device_key.identity_key_secret');
  const explicitPublic = deviceKey.identity_key_public ?? deviceKey.identityPublicKey;

  return {
    secretKey,
    publicKey: explicitPublic === undefined ? x25519PublicKey(secretKey) : decodeKeyBytes(explicitPublic, 'device_key.identity_key_public')
  };
}

function keyBundleFromRecipient(recipient: NotifyRecipientDevice): KeyBundle {
  const bundle = recipient.key_bundle;
  const oneTimePrekey = bundle.one_time_pre_key;
  const decoded: KeyBundle = {
    identityAgreementKey: decodeKeyBytes(bundle.identity_key, 'key_bundle.identity_key'),
    identitySigningKey: decodeKeyBytes(bundle.identity_signing_key, 'key_bundle.identity_signing_key'),
    signedPrekey: {
      keyId: requiredString(bundle.signed_pre_key.key_id, 'key_bundle.signed_pre_key.key_id'),
      publicKey: decodeKeyBytes(bundle.signed_pre_key.public_key, 'key_bundle.signed_pre_key.public_key'),
      signature: decodeKeyBytes(bundle.signed_pre_key.signature, 'key_bundle.signed_pre_key.signature')
    }
  };
  if (oneTimePrekey !== null && oneTimePrekey !== undefined) {
    return {
      ...decoded,
      oneTimePrekey: {
        keyId: requiredString(oneTimePrekey.key_id, 'key_bundle.one_time_pre_key.key_id'),
        publicKey: decodeKeyBytes(oneTimePrekey.public_key, 'key_bundle.one_time_pre_key.public_key')
      }
    };
  }
  return decoded;
}

function decodeSessionState(encoded: EncodedSessionState): SessionState {
  const session: SessionState = {
    rootKey: decodeKeyBytes(encoded.root_key, 'session.root_key'),
    localRatchetKeyPair: decodeKeyPair(encoded, 'session.local_ratchet'),
    sendingMessageNumber: encoded.sending_message_number ?? 0,
    receivingMessageNumber: encoded.receiving_message_number ?? 0,
    previousSendingChainLength: encoded.previous_sending_chain_length ?? 0,
    skippedMessageKeys: (encoded.skipped_message_keys ?? []).map((value) => ({
      ratchetPublicKeyHex: requiredString(value.ratchet_public_key_hex, 'session.skipped_message_keys.ratchet_public_key_hex'),
      messageNumber: value.message_number,
      messageKey: decodeKeyBytes(value.message_key, 'session.skipped_message_keys.message_key')
    })),
    maxSkippedMessageKeys: encoded.max_skipped_message_keys ?? 64
  };
  if (encoded.remote_ratchet_public_key !== undefined) {
    session.remoteRatchetPublicKey = decodeKeyBytes(encoded.remote_ratchet_public_key, 'session.remote_ratchet_public_key');
  }
  if (encoded.sending_chain_key !== undefined) {
    session.sendingChainKey = decodeKeyBytes(encoded.sending_chain_key, 'session.sending_chain_key');
  }
  if (encoded.receiving_chain_key !== undefined) {
    session.receivingChainKey = decodeKeyBytes(encoded.receiving_chain_key, 'session.receiving_chain_key');
  }
  if (encoded.pending_prekey !== undefined) {
    session.pendingPrekey =
      encoded.pending_prekey.one_time_prekey_id === undefined
        ? {
            signedPrekeyId: requiredString(encoded.pending_prekey.signed_prekey_id, 'session.pending_prekey.signed_prekey_id')
          }
        : {
            signedPrekeyId: requiredString(encoded.pending_prekey.signed_prekey_id, 'session.pending_prekey.signed_prekey_id'),
            oneTimePrekeyId: encoded.pending_prekey.one_time_prekey_id
          };
  }
  return session;
}

function decodeKeyPair(encoded: EncodedSessionState, label: string): KeyPair {
  return {
    publicKey: decodeKeyBytes(encoded.local_ratchet_public_key, `${label}_public_key`),
    secretKey: decodeKeyBytes(encoded.local_ratchet_secret_key, `${label}_secret_key`)
  };
}

function parseDeviceKey(input: string): EncodedDeviceKey {
  const trimmed = input.trim();
  const candidates = [trimmed, decodeUtf8IfPossible(trimmed)];
  for (const candidate of candidates) {
    if (candidate === undefined) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as EncodedDeviceKey;
      }
    } catch {
      // Try the next supported encoding.
    }
  }
  throw new Error('device_key must be JSON or base64url-encoded JSON key material.');
}

function decodeUtf8IfPossible(value: string): string | undefined {
  try {
    return Buffer.from(normaliseBase64(value), 'base64').toString('utf8');
  } catch {
    return undefined;
  }
}

function decodeKeyBytes(value: string, name: string): Uint8Array {
  const trimmed = requiredString(value, name);
  const hex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
  const bytes = hex ? Buffer.from(trimmed, 'hex') : Buffer.from(normaliseBase64(trimmed), 'base64');
  if (bytes.length === 0) {
    throw new Error(`${name} must decode to bytes.`);
  }
  return new Uint8Array(bytes);
}

function normaliseBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
}

function requiredString(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required.`);
  }
  return trimmed;
}
