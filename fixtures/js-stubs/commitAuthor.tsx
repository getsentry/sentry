import {User} from 'sentry/types';

export function CommitAuthorFixture(params: Partial<User> = {}): User {
  return {
    username: 'example@sentry.io',
    lastLogin: '2018-11-30T21:18:09.812Z',
    isSuperuser: true,
    isManaged: false,
    lastActive: '2018-11-30T21:25:15.222Z',
    id: '224288',
    isActive: true,
    has2fa: false,
    name: 'Foo Bar',
    isAuthenticated: true,
    isStaff: false,
    ip_address: '',
    avatarUrl: 'https://example.com/avatar.png',
    dateJoined: '2018-02-26T23:57:43.766Z',
    emails: [
      {
        is_verified: true,
        id: '231605',
        email: 'example@sentry.io',
      },
    ],
    avatar: {
      avatarUuid: null,
      avatarType: 'letter_avatar',
    },
    hasPasswordAuth: true,
    email: 'example@sentry.io',
    authenticators: [],
    options: {
      timezone: 'UTC',
      stacktraceOrder: 1,
      language: 'en',
      clock24Hours: false,
      defaultIssueEvent: 'recommended',
      avatarType: 'gravatar',
      theme: 'light',
      issueDetailsNewExperienceQ42023: false,
    },
    permissions: new Set(),
    canReset2fa: false,
    experiments: [],
    flags: {newsletter_consent_prompt: false},
    identities: [],
    ...params,
  };
}
