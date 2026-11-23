/** Route segments shared by `routes.tsx` and the service account pages. */
export const SERVICE_ACCOUNTS_PATH = 'service-accounts/';
export const NEW_SERVICE_ACCOUNT_PATH = 'new/';
export const EDIT_SERVICE_ACCOUNT_PATH = 'edit/';

// These return org-scoped paths without normalizing them. `Link` normalizes its `to`
// for customer domains, and `normalizeUrl` isn't idempotent: a second pass reads
// `service-accounts` as an org slug and drops it. Wrap the path in `normalizeUrl`
// only where nothing else does, such as `navigate()`.

export function getServiceAccountsUrl(orgSlug: string) {
  return `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}`;
}

export function getNewServiceAccountUrl(orgSlug: string) {
  return `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}${NEW_SERVICE_ACCOUNT_PATH}`;
}

export function getServiceAccountUrl(orgSlug: string, serviceAccountId: string) {
  return `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}${serviceAccountId}/`;
}

export function getEditServiceAccountUrl(orgSlug: string, serviceAccountId: string) {
  return `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}${serviceAccountId}/${EDIT_SERVICE_ACCOUNT_PATH}`;
}
