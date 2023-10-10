import type u2f from 'u2f-api';

import type {Field} from 'sentry/components/forms/types';
import {ControlSiloOrganization} from 'sentry/types/control_silo_organization';

export type AuthenticatorDevice = {
  authId: string;
  key_handle: string;
  name: string;
  timestamp?: string;
};

interface BaseAuthenticator extends Partial<Omit<EnrolledAuthenticator, 'createdAt'>> {
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
   * New enrollments of this 2FA interface are not allowed
   */
  disallowNewEnrollment: boolean;
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
}

export interface TotpAuthenticator extends BaseAuthenticator {
  id: 'totp';
  qrcode: string;
}

export interface SmsAuthenticator extends BaseAuthenticator {
  id: 'sms';
}

export interface U2fAuthenticator extends BaseAuthenticator {
  challenge: ChallengeData;
  id: 'u2f';
}
export interface RecoveryAuthenticator extends BaseAuthenticator {
  id: 'recovery';
}

export type Authenticator =
  | TotpAuthenticator
  | SmsAuthenticator
  | U2fAuthenticator
  | RecoveryAuthenticator;

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

// Users can have SSO providers of their own (social login with github)
// and organizations can have SSO configuration for SAML/google domain/okta.
// https://github.com/getsentry/sentry/pull/52469#discussion_r1258387880
export type AuthProvider = {
  key: string;
  name: string;
  requiredFeature: string;
};

export type OrganizationAuthProvider = {
  default_role: string;
  id: string;
  login_url: string;
  pending_links_count: number;
  provider_name: string;
  require_link: boolean;
  scim_enabled: boolean;
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
  organization: ControlSiloOrganization | null;
  provider: UserIdentityProvider;
  status: UserIdentityStatus;
};
