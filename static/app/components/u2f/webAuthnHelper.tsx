export function base64urlToBuffer(baseurl64String: string): ArrayBuffer {
  // Base64url to Base64
  const padding = '=='.slice(0, (4 - (baseurl64String.length % 4)) % 4);
  const base64String = baseurl64String.replace(/-/g, '+').replace(/_/g, '/') + padding;

  // Base64 to binary string
  const str = atob(base64String);

  // Binary string to buffer
  const buffer = new ArrayBuffer(str.length);
  const byteView = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    byteView[i] = str.charCodeAt(i);
  }
  return buffer;
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  // Buffer to binary string
  const byteView = new Uint8Array(buffer);
  let str = '';
  for (const charCode of byteView) {
    str += String.fromCharCode(charCode);
  }

  // Binary string to base64
  const base64String = btoa(str);

  // Base64 to base64url
  // We assume that the base64url string is well-formed.
  const base64urlString = base64String
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64urlString;
}

// Intermediate type needed for attaching client outputs to WebAuthn API call
// results before converting to JSON.

interface CredPropsAuthenticationExtensionsClientOutputsJSON {
  rk: boolean;
}

interface AuthenticationExtensionsClientOutputsJSON
  extends AuthenticationExtensionsClientOutputs {
  appidExclude?: boolean;
  credProps?: CredPropsAuthenticationExtensionsClientOutputsJSON;
}

export interface PublicKeyCredentialWithClientExtensionResults
  extends PublicKeyCredential {
  clientExtensionResults?: AuthenticationExtensionsClientOutputsJSON;
}

// Shared

export interface PublicKeyCredentialDescriptorJSON {
  type: PublicKeyCredentialType;
  id: string;
  transports?: AuthenticatorTransport[];
}

interface SimpleWebAuthnExtensionsJSON {
  appid?: string;
  appidExclude?: string;
  credProps?: boolean;
}

interface SimpleClientExtensionResultsJSON {
  appid?: boolean;
  appidExclude?: boolean;
  credProps?: CredPropsAuthenticationExtensionsClientOutputsJSON;
}

// `navigator.create()` request

interface PublicKeyCredentialUserEntityJSON extends PublicKeyCredentialEntity {
  displayName: string;
  id: string;
}

type ResidentKeyRequirement = 'discouraged' | 'preferred' | 'required';

interface AuthenticatorSelectionCriteriaJSON extends AuthenticatorSelectionCriteria {
  residentKey?: ResidentKeyRequirement;
}

export interface PublicKeyCredentialCreationOptionsJSON {
  rp: PublicKeyCredentialRpEntity;
  user: PublicKeyCredentialUserEntityJSON;

  challenge: string;
  pubKeyCredParams: PublicKeyCredentialParameters[];

  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[];
  authenticatorSelection?: AuthenticatorSelectionCriteriaJSON;
  attestation?: AttestationConveyancePreference;
  extensions?: SimpleWebAuthnExtensionsJSON;
}

export interface CredentialCreationOptionsJSON {
  publicKey: PublicKeyCredentialCreationOptionsJSON;
  signal?: AbortSignal;
}

// `navigator.create()` response

export interface AuthenticatorAttestationResponseJSON {
  clientDataJSON: string;
  attestationObject: string;
}

export interface PublicKeyCredentialWithAttestationJSON {
  id: string;
  type: PublicKeyCredentialType;
  rawId: string;
  response: AuthenticatorAttestationResponseJSON;
  clientExtensionResults: SimpleClientExtensionResultsJSON;
}

// `navigator.get()` request

export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: PublicKeyCredentialDescriptorJSON[];
  userVerification?: UserVerificationRequirement;
  extensions?: SimpleWebAuthnExtensionsJSON;
}

export interface CredentialRequestOptionsJSON {
  mediation?: CredentialMediationRequirement;
  publicKey?: PublicKeyCredentialRequestOptionsJSON;
  signal?: AbortSignal;
}

// `navigator.get()` response

interface AuthenticatorAssertionResponseJSON {
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string | null;
}

export interface PublicKeyCredentialWithAssertionJSON {
  type: PublicKeyCredentialType;
  id: string;
  rawId: string;
  response: AuthenticatorAssertionResponseJSON;
  clientExtensionResults: SimpleClientExtensionResultsJSON;
}
