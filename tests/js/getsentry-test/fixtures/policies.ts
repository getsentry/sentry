import {UserFixture} from 'sentry-fixture/user';

import type {Policy} from 'getsentry/types';

export function PoliciesFixture(): Record<string, Policy> {
  const mockUser = UserFixture();
  return {
    terms: {
      name: 'Terms and Conditions',
      url: 'https://sentry.io/legal/terms/1.0.0/',
      consent: {
        userName: mockUser.name,
        userEmail: mockUser.email,
        createdAt: '2018-01-01T17:43:38.220Z',
        acceptedVersion: '1.0.0',
      },
      version: '1.0.0',
      updatedAt: '2018-02-08T19:43:19.691Z',
      slug: 'terms',
      active: true,
      hasSignature: true,
      parent: '',
      standalone: true,
    },
    dpa: {
      name: 'Data Processing Amendment',
      url: 'https://sentry.io/legal/dpa/1.0.0/',
      consent: null,
      version: '1.0.0',
      updatedAt: '2018-03-08T17:43:24.384Z',
      slug: 'dpa',
      active: true,
      hasSignature: true,
      parent: '',
      standalone: true,
    },
    privacy: {
      name: 'Privacy Policy',
      url: 'https://sentry.io/legal/privacy/2.0.0/',
      consent: {
        userName: mockUser.name,
        userEmail: mockUser.email,
        createdAt: '2018-05-01T17:43:38.241Z',
        acceptedVersion: '1.0.0',
      },
      version: '2.0.0',
      updatedAt: '2018-05-15T23:43:42.590Z',
      slug: 'privacy',
      active: true,
      hasSignature: true,
      parent: '',
      standalone: true,
    },
    pentest: {
      name: 'Penetration Test Summary',
      url: 'https://sentry.io/legal/privacy/2.0.0/',
      consent: null,
      version: '1.0.0',
      updatedAt: '2018-05-15T23:43:42.590Z',
      slug: 'pentest',
      active: true,
      hasSignature: false,
      parent: '',
      standalone: true,
    },
  };
}
