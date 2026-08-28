import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

export type ServiceAccountToken = {
  expiresAt: string | null;
  id: string;
  name: string | null;
  scopes: string[];
  tokenLastCharacters: string | null;
};

export type ServiceAccount = {
  dateCreated: string;
  dateUpdated: string;
  id: string;
  isActive: boolean;
  name: string;
  role: string;
  teams: string[];
  tokens: ServiceAccountToken[];
};

export type ServiceAccountWithSecret = ServiceAccount & {token: string};
export type ServiceAccountTokenWithSecret = ServiceAccountToken & {token: string};

export function serviceAccountsQueryOptions(organizationSlug: string) {
  return apiOptions.as<ServiceAccount[]>()(
    '/organizations/$organizationIdOrSlug/service-accounts/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      staleTime: 0,
    }
  );
}

export function serviceAccountsUrl(organizationSlug: string) {
  return getApiUrl('/organizations/$organizationIdOrSlug/service-accounts/', {
    path: {organizationIdOrSlug: organizationSlug},
  });
}

export function serviceAccountUrl(organizationSlug: string, serviceAccountId: string) {
  return getApiUrl(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        serviceAccountId,
      },
    }
  );
}

export function serviceAccountTokensUrl(
  organizationSlug: string,
  serviceAccountId: string
) {
  return getApiUrl(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/tokens/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        serviceAccountId,
      },
    }
  );
}

export function serviceAccountTokenUrl(
  organizationSlug: string,
  serviceAccountId: string,
  tokenId: string
) {
  return getApiUrl(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/tokens/$tokenId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        serviceAccountId,
        tokenId,
      },
    }
  );
}
