import {AuthProvider} from 'sentry-fixture/authProvider';

import type {AuthProvider as AuthProviderType} from 'sentry/types';

export function AuthProviders(params: AuthProviderType[] = []): AuthProviderType[] {
  return [
    AuthProvider({
      key: 'dummy',
      name: 'Dummy',
      requiredFeature: 'organizations:sso-basic',
    }),
    AuthProvider({
      key: 'dummy2',
      name: 'Dummy SAML',
      requiredFeature: 'organizations:sso-saml2',
    }),
    ...params,
  ];
}
