import type {Organization} from 'sentry/types/organization';

const DEFAULT_SERVICE_ACCOUNT_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

/**
 * Scopes the current user can give a service account. The API rejects
 * `service_account:*` so an account can't create or widen other accounts.
 */
export function getGrantableServiceAccountScopes(organization: Organization): string[] {
  return organization.access.filter(
    scope =>
      scope.includes(':') &&
      !scope.startsWith('service_account:') &&
      scope !== 'org:superuser' &&
      scope !== 'org:billing'
  );
}

export function getDefaultServiceAccountScopes(organization: Organization): string[] {
  const grantable = new Set<string>(organization.access);
  return DEFAULT_SERVICE_ACCOUNT_SCOPES.filter(scope => grantable.has(scope));
}

/**
 * Keeps already-selected scopes listed even when the user can't grant them,
 * so editing an existing account doesn't silently drop them.
 */
export function getServiceAccountScopeOptions(
  grantableScopes: string[],
  selectedScopes: string[]
) {
  return [...new Set([...grantableScopes, ...selectedScopes])]
    .sort()
    .map(scope => ({value: scope, label: scope}));
}
