import {AuthProviderFixture} from 'sentry-fixture/authProvider';

import type {AuthProvider} from 'sentry/types/auth';

export function AuthProvidersFixture(params: AuthProvider[] = []): AuthProvider[] {
  return [
    AuthProviderFixture({
      key: 'dummy',
      name: 'Dummy',
      requiredFeature: 'organizations:sso-basic',
    }),
    AuthProviderFixture({
      key: 'dummy2',
      name: 'Dummy SAML',
      requiredFeature: 'organizations:sso-saml2',
    }),
    ...params,
  ];
}
