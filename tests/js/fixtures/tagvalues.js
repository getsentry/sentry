export function TagValues(params = []) {
  return [
    {
      username: 'david',
      hash: '172522ec1028ab781d9dfd17eaca4427',
      dateCreated: '2018-10-03T03:39:51.223Z',
      lastSeen: '2018-12-20T23:32:25Z',
      query: 'user.username:david',
      id: '10799',
      firstSeen: '2018-10-03T03:40:05.627Z',
      count: 3,
      name: 'David Cramer',
      avatarUrl:
        'https://secure.gravatar.com/avatar/d66694bbc7619203377bd9c9b7b9f14a?s=32&d=mm',
      value: 'username:david',
      tagValue: 'username:david',
      identifier: null,
      ipAddress: '128.126.232.84',
      email: 'david@example.com',
    },
    ...params,
  ];
}
