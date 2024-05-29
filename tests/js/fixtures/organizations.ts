import {OrganizationFixture} from 'sentry-fixture/organization';

import type {Organization} from 'sentry/types/organization';

export function OrganizationsFixture(params: Partial<Organization> = {}): Organization[] {
  return [
    OrganizationFixture({
      id: '1',
      name: 'test 1',
      slug: 'test 1',
      require2FA: false,
      status: {
        id: 'active',
        name: 'active',
      },
      ...params,
    }),
    OrganizationFixture({
      id: '2',
      name: 'test 2',
      slug: 'test 2',
      require2FA: false,
      status: {
        id: 'active',
        name: 'active',
      },
      ...params,
    }),
  ];
}
