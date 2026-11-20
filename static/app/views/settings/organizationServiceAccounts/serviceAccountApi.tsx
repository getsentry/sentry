import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import type {ServiceAccount} from './types';

export function serviceAccountsApiOptions(
  organization: Organization,
  {cursor}: {cursor?: string} = {}
) {
  return apiOptions.as<ServiceAccount[]>()(
    '/organizations/$organizationIdOrSlug/service-accounts/',
    {path: {organizationIdOrSlug: organization.slug}, query: {cursor}, staleTime: 0}
  );
}

export function serviceAccountApiOptions(
  organization: Organization,
  serviceAccountId: string
) {
  return apiOptions.as<ServiceAccount>()(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
    {path: {organizationIdOrSlug: organization.slug, serviceAccountId}, staleTime: 0}
  );
}
