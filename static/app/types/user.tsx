import {Authenticator, EnrolledAuthenticator} from './auth';
import {Avatar, Scope} from './core';
import {UserExperiments} from './experiments';

/**
 * Avatars are a more primitive version of User.
 */
export interface AvatarUser {
  id: string;
  name: string;
  username: string;
  email: string;
  ip_address: string;
  avatarUrl?: string;
  avatar?: Avatar;
  // Compatibility shim with EventUser serializer
  ipAddress?: string;
  options?: {
    avatarType: Avatar['avatarType'];
  };
  lastSeen?: string;
}

interface UserEnrolledAuthenticator {
  dateUsed: EnrolledAuthenticator['lastUsedAt'];
  dateCreated: EnrolledAuthenticator['createdAt'];
  type: Authenticator['id'];
  id: EnrolledAuthenticator['authId'];
  name: EnrolledAuthenticator['name'];
}

export type User = Omit<AvatarUser, 'options'> & {
  lastLogin: string;
  isSuperuser: boolean;
  isAuthenticated: boolean;
  emails: {
    is_verified: boolean;
    id: string;
    email: string;
  }[];
  isManaged: boolean;
  lastActive: string;
  isStaff: boolean;
  identities: any[];
  isActive: boolean;
  has2fa: boolean;
  canReset2fa: boolean;
  authenticators: UserEnrolledAuthenticator[];
  dateJoined: string;
  options: {
    theme: 'system' | 'light' | 'dark';
    timezone: string;
    stacktraceOrder: number;
    language: string;
    clock24Hours: boolean;
    avatarType: Avatar['avatarType'];
  };
  flags: {newsletter_consent_prompt: boolean};
  hasPasswordAuth: boolean;
  permissions: Set<string>;
  experiments: Partial<UserExperiments>;
};

// XXX(epurkhiser): we should understand how this is diff from User['emails]
// above
export interface UserEmail {
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
}

interface BaseApiToken {
  id: string;
  scopes: Scope[];
  expiresAt: string;
  dateCreated: string;
  state: string;
}

// We include the token for API tokens used for internal apps
export interface InternalAppApiToken extends BaseApiToken {
  application: null;
  token: string;
  refreshToken: string;
}

export interface ApiApplication {
  allowedOrigins: string[];
  clientID: string;
  clientSecret: string | null;
  homepageUrl: string | null;
  id: string;
  name: string;
  privacyUrl: string | null;
  redirectUris: string[];
  termsUrl: string | null;
}

// Used in user session history.
export interface InternetProtocol {
  id: string;
  ipAddress: string;
  lastSeen: string;
  firstSeen: string;
  countryCode: string | null;
  regionCode: string | null;
}

export interface SubscriptionDetails {
  disabled?: boolean;
  reason?: string;
}
