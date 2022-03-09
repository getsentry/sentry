import u2f from 'u2f-api';

import {Field} from 'sentry/components/forms/type';

import {Organization} from './organization';

export type AuthenticatorDevice = {
  authId: string;
  key_handle: string;
  name: string;
  timestamp?: string;
};

export type Authenticator = {
  /**
   * Allows multiple enrollments to authenticator
   */
  allowMultiEnrollment: boolean;
  /**
   * Allows authenticator's secret to be rotated without disabling
   */
  allowRotationInPlace: boolean;
  canValidateOtp: boolean;
  codes: string[];
  /**
   * String to display on button for additional information about authenticator
   */
  configureButton: string;
  createdAt: string | null;
  /**
   * Description of the authenticator
   */
  description: string;
  devices: AuthenticatorDevice[];
  /**
   * String used to display on button for user as CTA to enroll
   */
  enrollButton: string;
  /**
   * Is this used as a backup interface?
   */
  isBackupInterface: boolean;
  /**
   * Is user enrolled to this authenticator
   */
  isEnrolled: boolean;
  lastUsedAt: string | null;
  /**
   * Display name for the authenticator
   */
  name: string;
  /**
   * String to display on button for user to remove authenticator
   */
  removeButton: string | null;
  rotationWarning: string | null;
  status: string;
  /**
   * The form configuration for the authenticator is present during enrollment
   */
  form?: Field[];
  phone?: string;
  secret?: string;
} & Partial<EnrolledAuthenticator> &
  (
    | {
        id: 'sms';
      }
    | {
        id: 'totp';
        qrcode: string;
      }
    | {
        challenge: ChallengeData;
        id: 'u2f';
      }
  );

export type ChallengeData = {
  // will have only authenticateRequest or registerRequest
  authenticateRequests: u2f.SignRequest;
  registerRequests: u2f.RegisterRequest;
  registeredKeys: u2f.RegisteredKey[];
  webAuthnAuthenticationData: string;
  // for WebAuthn register
  webAuthnRegisterData: string;
};

export type EnrolledAuthenticator = {
  authId: string;
  createdAt: string;
  lastUsedAt: string | null;
  name: string;
};

/**
 * This is an authenticator that a user is enrolled in
 */
export type UserEnrolledAuthenticator = {
  dateCreated: EnrolledAuthenticator['createdAt'];
  dateUsed: EnrolledAuthenticator['lastUsedAt'];
  id: EnrolledAuthenticator['authId'];
  name: EnrolledAuthenticator['name'];
  type: Authenticator['id'];
};

/**
 * XXX(ts): This actually all comes from getsentry. We should definitely
 * refactor this into a more proper 'hook' mechanism in the future
 */
export type AuthConfig = {
  canRegister: boolean;
  githubLoginLink: string;
  googleLoginLink: string;
  hasNewsletter: boolean;
  serverHostname: string;
  vstsLoginLink: string;
};

export type AuthProvider = {
  disables2FA: boolean;
  key: string;
  name: string;
  requiredFeature: string;
};

export enum UserIdentityCategory {
  SOCIAL_IDENTITY = 'social-identity',
  GLOBAL_IDENTITY = 'global-identity',
  ORG_IDENTITY = 'org-identity',
}

export enum UserIdentityStatus {
  CAN_DISCONNECT = 'can_disconnect',
  NEEDED_FOR_GLOBAL_AUTH = 'needed_for_global_auth',
  NEEDED_FOR_ORG_AUTH = 'needed_for_org_auth',
}

export type UserIdentityProvider = {
  key: string;
  name: string;
};

/**
 * UserIdentityConfig is used in Account Identities
 */
export type UserIdentityConfig = {
  category: UserIdentityCategory;
  dateAdded: string | null;
  dateSynced: string | null;
  dateVerified: string | null;
  id: string;
  isLogin: boolean;
  name: string;
  organization: Organization | null;
  provider: UserIdentityProvider;
  status: UserIdentityStatus;
};
