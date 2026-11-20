import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

/** Route segments shared by `routes.tsx` and the service account pages. */
export const SERVICE_ACCOUNTS_PATH = 'service-accounts/';
export const NEW_SERVICE_ACCOUNT_PATH = 'new/';
export const EDIT_SERVICE_ACCOUNT_PATH = 'edit/';

export function getServiceAccountsUrl(orgSlug: string) {
  return normalizeUrl(`/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}`);
}

export function getNewServiceAccountUrl(orgSlug: string) {
  return normalizeUrl(
    `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}${NEW_SERVICE_ACCOUNT_PATH}`
  );
}

export function getServiceAccountUrl(orgSlug: string, serviceAccountId: string) {
  return normalizeUrl(
    `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}${serviceAccountId}/`
  );
}

export function getEditServiceAccountUrl(orgSlug: string, serviceAccountId: string) {
  return normalizeUrl(
    `/settings/${orgSlug}/${SERVICE_ACCOUNTS_PATH}${serviceAccountId}/${EDIT_SERVICE_ACCOUNT_PATH}`
  );
}
