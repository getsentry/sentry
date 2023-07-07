import type {AuthProvider as AuthProviderType} from 'sentry/types';

export function AuthProvider(params: Partial<AuthProviderType> = {}): AuthProviderType {
  return {
    key: 'auth_provider_key',
    name: 'auth_provider_name',
    requiredFeature: 'auth_provider_required_feature',
    ...params,
  };
}
