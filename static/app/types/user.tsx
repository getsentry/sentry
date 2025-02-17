import type {UserEnrolledAuthenticator} from './auth';
import type {Avatar, Scope} from './core';
import type {UserExperiments} from './experiments';

/**
 * Avatars are a more primitive version of User.
 */
export type AvatarUser = {
  email: string;
  id: string;
  ip_address: string;
  name: string;
  username: string;
  avatar?: Avatar;
  avatarUrl?: string;
  ip?: string;
  // Compatibility shim with EventUser serializer
  ipAddress?: string;
  lastSeen?: string;
  options?: {
    avatarType: Avatar['avatarType'];
  };
};

// This object tracks the status of the quick start display for each organization.
// The key is the organization ID, and the value represents the display status:
// Null = Hidden on the first visit
// 1 = Shown once (on the second visit)
// 2 = Hidden automatically after the second visit
type QuickStartDisplay = Record<string, number>;
export interface User extends Omit<AvatarUser, 'options'> {
  canReset2fa: boolean;
  dateJoined: string;
  emails: Array<{
    email: string;
    id: string;
    is_verified: boolean;
  }>;
  experiments: Partial<UserExperiments>;
  flags: {newsletter_consent_prompt: boolean};
  has2fa: boolean;
  hasPasswordAuth: boolean;
  identities: any[];
  isActive: boolean;
  isAuthenticated: boolean;
  isManaged: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  lastActive: string;
  lastLogin: string;
  options: {
    avatarType: Avatar['avatarType'];
    clock24Hours: boolean;
    defaultIssueEvent: 'recommended' | 'latest' | 'oldest';
    language: string;
    prefersIssueDetailsStreamlinedUI: boolean;
    quickStartDisplay: QuickStartDisplay;
    stacktraceOrder: number;
    theme: 'system' | 'light' | 'dark';
    timezone: string;
  };
  permissions: Set<string>;
  authenticators?: UserEnrolledAuthenticator[];
}

// XXX(epurkhiser): we should understand how this is diff from User['emails]
// above
export type UserEmail = {
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
};

/**
 * API tokens and Api Applications.
 */
// See src/sentry/api/serializers/models/apitoken.py for the differences based on application
interface BaseApiToken {
  dateCreated: string;
  expiresAt: string;
  id: string;
  name: string;
  scopes: Scope[];
  state: string;
}

// API Tokens should not be using and storing the token values in the application, as the tokens are secrets.
export interface InternalAppApiToken extends BaseApiToken {
  application: null;
  refreshToken: string;
  tokenLastCharacters: string;
}

// We include the token for new API tokens
export interface NewInternalAppApiToken extends InternalAppApiToken {
  token: string;
}

export type ApiApplication = {
  allowedOrigins: string[];
  clientID: string;
  clientSecret: string | null;
  homepageUrl: string | null;
  id: string;
  name: string;
  privacyUrl: string | null;
  redirectUris: string[];
  termsUrl: string | null;
};

export type OrgAuthToken = {
  dateCreated: Date;
  id: string;
  name: string;
  scopes: string[];
  dateLastUsed?: Date;
  projectLastUsedId?: string;
  tokenLastCharacters?: string;
};

// Used in user session history.
export type InternetProtocol = {
  countryCode: string | null;
  firstSeen: string;
  id: string;
  ipAddress: string;
  lastSeen: string;
  regionCode: string | null;
};

export type SubscriptionDetails = {disabled?: boolean; reason?: string};
