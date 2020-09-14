export function CommitAuthor(params = {}) {
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
    ...params,
  };
}
