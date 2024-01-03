import {AuthProviderFixture} from 'sentry-fixture/authProvider';

import type {AuthProvider as AuthProviderType} from 'sentry/types';

export function AuthProvidersFixture(
  params: AuthProviderType[] = []
): AuthProviderType[] {
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
