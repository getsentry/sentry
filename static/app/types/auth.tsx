import u2f from 'u2f-api';

import {Field} from 'sentry/views/settings/components/forms/type';

export type AuthenticatorDevice = {
  key_handle: string;
  authId: string;
  name: string;
  timestamp?: string;
};

export type Authenticator = {
  /**
   * String used to display on button for user as CTA to enroll
   */
  enrollButton: string;
  /**
   * Display name for the authenticator
   */
  name: string;
  /**
   * Allows multiple enrollments to authenticator
   */
  allowMultiEnrollment: boolean;
  /**
   * Allows authenticator's secret to be rotated without disabling
   */
  allowRotationInPlace: boolean;
  /**
   * String to display on button for user to remove authenticator
   */
  removeButton: string | null;
  canValidateOtp: boolean;
  /**
   * Is user enrolled to this authenticator
   */
  isEnrolled: boolean;
  /**
   * String to display on button for additional information about authenticator
   */
  configureButton: string;
  /**
   * Is this used as a backup interface?
   */
  isBackupInterface: boolean;
  /**
   * Description of the authenticator
   */
  description: string;
  rotationWarning: string | null;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  codes: string[];
  devices: AuthenticatorDevice[];
  phone?: string;
  secret?: string;
  /**
   * The form configuration for the authenticator is present during enrollment
   */
  form?: Field[];
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
        id: 'u2f';
        challenge: ChallengeData;
      }
  );

export type ChallengeData = {
  // will have only authenticateRequest or registerRequest
  authenticateRequests: u2f.SignRequest;
  registerRequests: u2f.RegisterRequest;
  registeredKeys: u2f.RegisteredKey[];
};

export type EnrolledAuthenticator = {
  lastUsedAt: string | null;
  createdAt: string;
  authId: string;
  name: string;
};

/**
 * This is an authenticator that a user is enrolled in
 */
export type UserEnrolledAuthenticator = {
  dateUsed: EnrolledAuthenticator['lastUsedAt'];
  dateCreated: EnrolledAuthenticator['createdAt'];
  type: Authenticator['id'];
  id: EnrolledAuthenticator['authId'];
  name: EnrolledAuthenticator['name'];
};

/**
 * XXX(ts): This actually all comes from getsentry. We should definitely
 * refactor this into a more proper 'hook' mechanism in the future
 */
export type AuthConfig = {
  canRegister: boolean;
  serverHostname: string;
  hasNewsletter: boolean;
  githubLoginLink: string;
  vstsLoginLink: string;
  googleLoginLink: string;
};

export type AuthProvider = {
  key: string;
  name: string;
  requiredFeature: string;
  disables2FA: boolean;
};
