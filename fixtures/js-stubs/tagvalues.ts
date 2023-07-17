import type {TagValue} from 'sentry/types';

export function TagValues(params = []): TagValue[] {
  return [
    {
      username: 'david',
      lastSeen: '2018-12-20T23:32:25Z',
      query: 'user.username:david',
      id: '10799',
      firstSeen: '2018-10-03T03:40:05.627Z',
      count: 3,
      name: 'David Cramer',
      avatarUrl:
        'https://secure.gravatar.com/avatar/d66694bbc7619203377bd9c9b7b9f14a?s=32&d=mm',
      value: 'username:david',
      identifier: undefined,
      ipAddress: '128.126.232.84',
      email: 'david@example.com',
      ip_address: '0.0.0.0',
    },
    ...params,
  ];
}
