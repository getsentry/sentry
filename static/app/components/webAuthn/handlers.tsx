import {decode} from 'cbor2';

import type {ChallengeData} from 'sentry/types/auth';

function base64urlToUint8(baseurl64String: string): Uint8Array {
  const padding = '=='.slice(0, (4 - (baseurl64String.length % 4)) % 4);
  const base64 = baseurl64String.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Register a new credential using WebAuthn (FIDO2) and return its attestation data.
 */
export async function handleEnroll(challengeData: ChallengeData) {
  const binaryChallenge = base64urlToUint8(challengeData.webAuthnRegisterData);
  const {publicKey}: CredentialCreationOptions = decode(binaryChallenge);
  const credential = await navigator.credentials.create({publicKey});

  if (!(credential instanceof PublicKeyCredential)) {
    return null;
  }

  if (!(credential.response instanceof AuthenticatorAttestationResponse)) {
    return null;
  }

  const authenticatorData = {
    id: credential.id,
    type: credential.type,
    rawId: bufferToBase64url(credential.rawId),
    response: {
      attestationObject: bufferToBase64url(credential.response.attestationObject),
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
    },
  };

  return JSON.stringify(authenticatorData);
}

/**
 * Perform a WebAuthn assertion (login) using an existing credential.
 */
export async function handleSign(challengeData: ChallengeData) {
  const binaryChallenge = base64urlToUint8(challengeData.webAuthnAuthenticationData);
  const options: PublicKeyCredentialRequestOptions = decode(binaryChallenge);
  const credential = await navigator.credentials.get({publicKey: options});

  if (!(credential instanceof PublicKeyCredential)) {
    return null;
  }

  if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
    return null;
  }
  const authenticatorData = {
    keyHandle: credential.id,
    clientData: bufferToBase64url(credential.response.clientDataJSON),
    signatureData: bufferToBase64url(credential.response.signature),
    authenticatorData: bufferToBase64url(credential.response.authenticatorData),
  };

  return JSON.stringify(authenticatorData);
}
