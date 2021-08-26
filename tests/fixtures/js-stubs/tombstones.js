export function Tombstones(params = []) {
  return [
    {
      culprit: 'poll(../../sentry/scripts/views.js)',
      level: 'error',
      actor: {
        username: 'billy@sentry.io',
        emails: [
          {is_verified: false, id: '28', email: 'test@test.com'},
          {is_verified: false, id: '17', email: 'billy36@sentry.io'},
          {is_verified: false, id: '11', email: 'awerawer@awe.com'},
          {is_verified: true, id: '10', email: 'billy2@sentry.io'},
          {is_verified: true, id: '5', email: 'billy@sentry.io'},
        ],
        isManaged: false,
        lastActive: '2018-02-21T01:27:52.255Z',
        identities: [
          {
            name: '79684',
            dateVerified: '2018-02-21T00:52:40.149Z',
            provider: {id: 'github', name: 'GitHub'},
            dateSynced: '2018-02-21T00:52:40.149Z',
            organization: {slug: 'default', name: 'default'},
            id: '1',
          },
        ],
        id: '1',
        isActive: true,
        has2fa: true,
        name: 'billy vong',
        avatarUrl:
          'https://secure.gravatar.com/avatar/7b544e8eb9d08ed777be5aa82121155a?s=32&d=mm',
        dateJoined: '2018-01-10T00:19:59Z',
        options: {
          timezone: 'America/Los_Angeles',
          seenReleaseBroadcast: true,
          stacktraceOrder: -1,
          language: 'en',
          clock24Hours: false,
        },
        avatar: {
          avatarUuid: '483ed7478a2248d59211f538c2997e0b',
          avatarType: 'letter_avatar',
        },
        lastLogin: '2018-02-14T07:09:37.536Z',
        permissions: [],
        email: 'billy@sentry.io',
      },
      message:
        "This is an example JavaScript exception TypeError Object [object Object] has no method 'updateFrom' poll(../../sentry/scripts/views.js)",
      type: 'error',
      id: '1',
      metadata: {
        type: 'TypeError',
        value: "Object [object Object] has no method 'updateFrom'",
      },
    },
    ...params,
  ];
}
