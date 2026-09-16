import type {User} from 'sentry/types/user';

export type MfaMethod = {
  id: 'recovery' | 'sms' | 'totp' | 'u2f';
};

export interface AuthenticatedResult {
  nextUri: string;
  user: User;
}
