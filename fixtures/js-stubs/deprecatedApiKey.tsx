import type {DeprecatedApiKey as DeprecatedApiKeyType} from 'sentry/views/settings/organizationApiKeys/types';

export function DeprecatedApiKey(
  params: Partial<DeprecatedApiKeyType> = {}
): DeprecatedApiKeyType {
  return {
    allowed_origins: '',
    id: '1',
    key: 'aa624bcc12024702a202cd90be5feda0',
    label: 'Default',
    scope_list: ['project:read', 'event:read', 'team:read', 'member:read'],
    status: 0,
    ...params,
  };
}
