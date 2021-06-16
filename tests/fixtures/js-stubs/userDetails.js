export function UserDetails(params = {}) {
  return {
    username: 'billyfirefoxusername@test.com',
    emails: [
      {is_verified: false, id: '20', email: 'billyfirefox@test.com2'},
      {is_verified: true, id: '8', email: 'billyfirefox2@test.com'},
      {is_verified: false, id: '7', email: 'billyfirefox@test.com'},
    ],
    isManaged: false,
    lastActive: '2018-01-25T21:00:19.946Z',
    identities: [],
    id: '4',
    isActive: true,
    has2fa: false,
    name: 'Firefox Billy',
    avatarUrl:
      'https://secure.gravatar.com/avatar/5df53e28e63099658c1ba89b8e9a7cf4?s=32&d=mm',
    authenticators: [],
    dateJoined: '2018-01-11T00:30:41.366Z',
    options: {
      timezone: 'UTC',
      seenReleaseBroadcast: null,
      stacktraceOrder: 'default',
      language: 'en',
      clock24Hours: false,
    },
    avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
    lastLogin: '2018-01-25T19:57:46.973Z',
    permissions: [],
    email: 'billyfirefox@test.com',
    ...params,
  };
}
