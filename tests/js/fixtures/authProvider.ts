import type {AuthProvider} from 'sentry/types/auth';

export function AuthProviderFixture(params: Partial<AuthProvider> = {}): AuthProvider {
  return {
    key: 'auth_provider_key',
    name: 'auth_provider_name',
    requiredFeature: 'organizations:sso-basic',
    ...params,
  };
}
