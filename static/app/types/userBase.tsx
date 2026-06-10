import type {Avatar} from 'sentry/types/coreBase';

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

export enum StacktraceOrder {
  DEFAULT = -1, // Equivalent to `MOST_RECENT_FIRST`
  MOST_RECENT_LAST = 1,
  MOST_RECENT_FIRST = 2,
}

// XXX(epurkhiser): we should understand how this is diff from User['emails]
// above
export type UserEmail = {
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
};

export type ApiApplication = {
  allowedOrigins: string[];
  clientID: string;
  clientSecret: string | null;
  homepageUrl: string | null;
  id: string;
  /**
   * Whether this is a public client (no client_secret).
   * Public clients are used for CLIs, native apps, and SPAs that
   * cannot securely store a client secret (RFC 6749 §2.1).
   */
  isPublic: boolean;
  name: string;
  privacyUrl: string | null;
  redirectUris: string[];
  termsUrl: string | null;
  // Remove the optional marker after June 1, 2026 once the backend field is deployed everywhere.
  dateCreated?: string;
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
