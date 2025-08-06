import type {AvatarUser} from 'sentry/types/user';

interface UserWithOrganizations extends Omit<AvatarUser, 'options'> {
  lastActive: string;
  organizations: string[];
}

export function MergeAccountsFixture(
  params: UserWithOrganizations[] = []
): UserWithOrganizations[] {
  return [
    {
      id: '1',
      username: 'user1',
      email: 'user@example.com',
      name: 'primary',
      ip_address: '127.0.0.1',
      lastActive: '2025-01-01T00:00:00.000Z',
      organizations: ['hojicha'],
    },
    {
      id: '2',
      username: 'user2',
      email: 'user@example.com',
      name: 'merge me',
      ip_address: '127.0.0.1',
      lastActive: '2020-01-01T00:00:00.000Z',
      organizations: ['hojicha', 'matcha'],
    },
    {
      id: '3',
      username: 'user3',
      email: 'user@example.com',
      name: 'delete me',
      ip_address: '127.0.0.1',
      lastActive: '',
      organizations: [],
    },
    ...params,
  ];
}

export function MergeAccountsSingleAccountFixture(
  params: UserWithOrganizations[] = []
): UserWithOrganizations[] {
  return [
    {
      id: '1',
      username: 'user1',
      email: 'user@example.com',
      name: 'primary',
      ip_address: '127.0.0.1',
      lastActive: '2025-01-01T00:00:00.000Z',
      organizations: ['hojicha', 'matcha'],
    },
    ...params,
  ];
}
