import * as core from '@actions/core';
import {
  generateEd25519KeyPair,
  generateIdentityKeyPair,
  generateOneTimePrekey,
  generateSignedPrekey,
  publicOneTimePrekey,
  publicSignedPrekey
} from '@attomus/semafore-crypto';
import { randomUUID } from 'node:crypto';

import type { BootstrapDeviceRegisterRequest, SemaForeClient } from './client.js';
import type { BootstrapInputs } from './inputs.js';
import type { Logger } from './logger.js';
import type { RepoSecretWriter } from './secrets.js';

const DEVICE_SECRET_NAME = 'SEMAFORE_DEVICE_KEY';
const ONE_TIME_PREKEY_COUNT = 100;

interface BootstrapDeviceMaterial {
  readonly identity: ReturnType<typeof generateIdentityKeyPair>;
  readonly signing: ReturnType<typeof generateEd25519KeyPair>;
  readonly signedPrekey: ReturnType<typeof generateSignedPrekey>;
  readonly oneTimePrekeys: Array<ReturnType<typeof generateOneTimePrekey>>;
}

export async function runBootstrap(
  inputs: BootstrapInputs,
  client: SemaForeClient,
  secretWriter: RepoSecretWriter,
  logger: Logger
): Promise<void> {
  logger.setSecret(inputs.token);

  if (await secretWriter.secretExists(DEVICE_SECRET_NAME)) {
    throw new Error('SEMAFORE_DEVICE_KEY already exists. Revoke the existing SemaFore device before re-bootstrap.');
  }

  const material = generateDeviceMaterial();
  const response = await client.registerDevice(registrationRequest(material));
  const encodedDeviceKey = encodeDeviceKey(material, response.device_id);

  logger.setSecret(encodedDeviceKey);
  try {
    await secretWriter.writeSecret(DEVICE_SECRET_NAME, encodedDeviceKey);
  } catch (error: unknown) {
    throw new Error(
      `SemaFore device ${response.device_id} was registered, but writing ${DEVICE_SECRET_NAME} failed. ` +
        `Revoke that device before retrying bootstrap. ${errorMessage(error)}`,
      { cause: error }
    );
  }

  logger.setOutput('device_id', response.device_id);
  logger.info('SemaFore device registered. You can now remove the bootstrap step from your workflow.');
}

export function githubToken(): string {
  return core.getInput('github_token');
}

function generateDeviceMaterial(): BootstrapDeviceMaterial {
  const identity = generateIdentityKeyPair();
  const signing = generateEd25519KeyPair();
  const signedPrekey = generateSignedPrekey(signing.secretKey, `spk-${randomUUID()}`);
  const oneTimePrekeys = Array.from({ length: ONE_TIME_PREKEY_COUNT }, (_, index) =>
    generateOneTimePrekey(`opk-${String(index + 1).padStart(3, '0')}-${randomUUID()}`)
  );

  return { identity, signing, signedPrekey, oneTimePrekeys };
}

function registrationRequest(material: BootstrapDeviceMaterial): BootstrapDeviceRegisterRequest {
  const signedPrekey = publicSignedPrekey(material.signedPrekey);
  return {
    device_kind: 'integration_github_action',
    display_name: displayName(),
    identity_key_pub: encodeKey(material.identity.publicKey),
    signed_prekey: {
      key_id: signedPrekey.keyId,
      key_pub: encodeKey(signedPrekey.publicKey),
      signature: encodeKey(signedPrekey.signature)
    },
    one_time_prekeys: material.oneTimePrekeys.map((prekey) => {
      const publicPrekey = publicOneTimePrekey(prekey);
      return {
        key_id: publicPrekey.keyId,
        key_pub: encodeKey(publicPrekey.publicKey)
      };
    })
  };
}

function encodeDeviceKey(material: BootstrapDeviceMaterial, deviceId: string): string {
  return JSON.stringify({
    version: 1,
    device_id: deviceId,
    device_kind: 'integration_github_action',
    identity_key_secret: encodeKey(material.identity.secretKey),
    identity_key_public: encodeKey(material.identity.publicKey),
    identity_signing_key_secret: encodeKey(material.signing.secretKey),
    identity_signing_key_public: encodeKey(material.signing.publicKey),
    signed_pre_key: {
      key_id: material.signedPrekey.keyId,
      secret_key: encodeKey(material.signedPrekey.secretKey),
      public_key: encodeKey(material.signedPrekey.publicKey),
      signature: encodeKey(material.signedPrekey.signature)
    },
    one_time_pre_keys: material.oneTimePrekeys.map((prekey) => ({
      key_id: prekey.keyId,
      secret_key: encodeKey(prekey.secretKey),
      public_key: encodeKey(prekey.publicKey)
    })),
    sessions: {}
  });
}

function displayName(): string {
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  return repository ? `GitHub Actions: ${repository}` : 'GitHub Actions';
}

function encodeKey(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
