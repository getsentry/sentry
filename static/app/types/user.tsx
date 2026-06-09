import {StacktraceOrder} from 'sentry/types/userBase';
import type {AvatarUser} from 'sentry/types/userBase';

import type {UserEnrolledAuthenticator} from './auth';
import type {Scope} from './core';
import type {Avatar} from './coreBase';

export interface User extends Omit<AvatarUser, 'options'> {
  canReset2fa: boolean;
  dateJoined: string;
  emails: Array<{
    email: string;
    id: string;
    is_verified: boolean;
  }>;
  flags: {newsletter_consent_prompt: boolean};
  has2fa: boolean;
  hasPasswordAuth: boolean;
  identities: any[];
  isActive: boolean;
  isAuthenticated: boolean;
  isManaged: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  isSuspended: boolean;
  lastActive: string;
  lastLogin: string;
  options: {
    avatarType: Avatar['avatarType'];
    clock24Hours: boolean;
    defaultIssueEvent: 'recommended' | 'latest' | 'oldest';
    language: string;
    prefersIssueDetailsStreamlinedUI: boolean | null;
    stacktraceOrder: StacktraceOrder;
    theme: 'system' | 'light' | 'dark';
    timezone: string;
  };
  permissions: Set<string>;
  authenticators?: UserEnrolledAuthenticator[];
}

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
