import type {UserEmail} from 'sentry/types';

export function AccountEmailsFixture(params: UserEmail[] = []): UserEmail[] {
  return [
    {
      email: 'primary@example.com',
      isPrimary: true,
      isVerified: true,
    },
    {
      email: 'secondary1@example.com',
      isPrimary: false,
      isVerified: true,
    },
    {
      email: 'secondary2@example.com',
      isPrimary: false,
      isVerified: false,
    },
    ...params,
  ];
}
