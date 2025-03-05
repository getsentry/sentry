import type {User} from 'sentry/types/user';

export function UserFixture(params: Partial<User> = {}): User {
  return {
    id: '1',
    username: 'foo@example.com',
    email: 'foo@example.com',
    name: 'Foo Bar',
    isAuthenticated: true,
    options: {
      clock24Hours: false,
      timezone: 'UTC',
      language: 'en',
      theme: 'system',
      defaultIssueEvent: 'recommended',
      avatarType: 'letter_avatar',
      stacktraceOrder: -1,
      prefersIssueDetailsStreamlinedUI: false,
      prefersStackedNavigation: false,
      quickStartDisplay: {},
    },
    ip_address: '127.0.0.1',
    hasPasswordAuth: true,
    authenticators: [],
    canReset2fa: false,
    dateJoined: '2020-01-01T00:00:00.000Z',
    emails: [],
    experiments: [],
    has2fa: false,
    identities: [],
    isActive: false,
    isManaged: false,
    isStaff: false,
    isSuperuser: false,
    lastActive: '2020-01-01T00:00:00.000Z',
    lastLogin: '2020-01-01T00:00:00.000Z',
    permissions: new Set(),
    flags: {
      newsletter_consent_prompt: false,
    },
    ...params,
  };
}
