import type {
  RecoveryAuthenticator as RecoveryAuthenticatorType,
  SmsAuthenticator as SmsAuthenticatorType,
  TotpAuthenticator as TotpAuthenticatorType,
  U2fAuthenticator as U2fAuthenticatorType,
  UserEnrolledAuthenticator as UserEnrolledAuthenticatorType,
} from 'sentry/types';

export function Authenticators(): {
  Recovery: (props?: Partial<RecoveryAuthenticatorType>) => RecoveryAuthenticatorType;
  Sms: (props?: Partial<SmsAuthenticatorType>) => SmsAuthenticatorType;
  Totp: (props?: Partial<TotpAuthenticatorType>) => TotpAuthenticatorType;
  U2f: (props?: Partial<U2fAuthenticatorType>) => U2fAuthenticatorType;
} {
  return {
    Totp: (p = {}) => ({
      lastUsedAt: null,
      enrollButton: 'Enroll',
      description:
        'An authenticator application that supports TOTP (like Google Authenticator or 1Password) can be used to conveniently secure your account.  A new token is generated every 30 seconds.',
      isEnrolled: true,
      removeButton: 'Remove',
      id: 'totp',
      createdAt: '2018-01-30T17:24:36.554Z',
      configureButton: 'Info',
      name: 'Authenticator App',
      allowMultiEnrollment: false,
      disallowNewEnrollment: false,
      authId: '15',
      canValidateOtp: true,
      isBackupInterface: false,
      allowRotationInPlace: false,
      authenticatorDevice: [],
      devices: [],
      rotationWarning: null,
      status: 'active',
      codes: ['123-456'],
      qrcode: 'qr-code',
      ...p,
    }),
    Sms: (p = {}) => ({
      createdAt: '2018-01-30T17:24:36.554Z',
      lastUsedAt: null,
      enrollButton: 'Enroll',
      name: 'Text Message',
      allowMultiEnrollment: false,
      removeButton: 'Remove',
      canValidateOtp: true,
      isEnrolled: false,
      configureButton: 'Info',
      id: 'sms',
      isBackupInterface: false,
      disallowNewEnrollment: false,
      allowRotationInPlace: false,
      authenticatorDevice: [],
      devices: [],
      rotationWarning: null,
      status: 'active',
      codes: ['123-456'],
      qrcode: 'qr-code',
      description:
        "This authenticator sends you text messages for verification.  It's useful as a backup method or when you do not have a phone that supports an authenticator application.",
      ...p,
    }),
    U2f: (p = {}) => ({
      lastUsedAt: null,
      enrollButton: 'Enroll',
      description:
        "Authenticate with a U2F hardware device. This is a device like a Yubikey or something similar which supports FIDO's U2F specification. This also requires a browser which supports this system (like Google Chrome).",
      isEnrolled: true,
      removeButton: 'Remove',
      id: 'u2f',
      createdAt: '2018-01-30T20:56:45.932Z',
      configureButton: 'Configure',
      name: 'U2F (Universal 2nd Factor)',
      allowMultiEnrollment: true,
      disallowNewEnrollment: false,
      authId: '23',
      canValidateOtp: false,
      isBackupInterface: false,
      allowRotationInPlace: false,
      devices: [],
      rotationWarning: null,
      status: 'active',
      codes: [],
      challenge: {
        webAuthnAuthenticationData: 'webAuthnAuthenticationData',
        authenticateRequests: {
          version: 'U2F_V2',
          appId: 'https://sentry.io',
          keyHandle: 'keyHandle',
          challenge: 'challenge',
        },
        registerRequests: {
          version: 'U2F_V2',
          appId: 'https://sentry.io',
          challenge: 'challenge',
        },
        registeredKeys: [],
        // for WebAuthn register
        webAuthnRegisterData: 'webAuthnRegisterData',
      },
      ...p,
    }),
    Recovery: (p = {}) => ({
      id: 'recovery',
      lastUsedAt: null,
      enrollButton: 'Activate',
      allowRotationInPlace: false,
      devices: [],
      disallowNewEnrollment: false,
      rotationWarning: null,
      status: 'active',
      description:
        'Recovery codes are the only way to access your account if you lose your device and cannot receive two-factor authentication codes.',
      isEnrolled: true,
      removeButton: null,
      createdAt: '2018-01-30T17:24:36.570Z',
      configureButton: 'View Codes',
      name: 'Recovery Codes',
      allowMultiEnrollment: false,
      authId: '16',
      canValidateOtp: true,
      isBackupInterface: true,
      codes: ['ABCD-1234', 'EFGH-5678'],
      ...p,
    }),
  };
}

export function AllAuthenticators() {
  return Object.values(Authenticators()).map(x => x());
}

export function UserEnrolledAuthenticator(
  params: Partial<UserEnrolledAuthenticatorType>
): UserEnrolledAuthenticatorType {
  return {
    id: '1',
    type: 'totp',
    name: 'auth',
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUsed: '2020-01-01T00:00:00.000Z',
    ...params,
  };
}
