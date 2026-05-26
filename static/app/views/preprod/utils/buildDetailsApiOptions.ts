import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export function buildDetailsApiOptions({
  queryParams,
  organization,
}: {
  organization: Organization;
  queryParams?: Record<string, unknown>;
}) {
  return apiOptions.as<BuildDetailsApiResponse[]>()(
    '/organizations/$organizationIdOrSlug/builds/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: queryParams,
      staleTime: 0,
    }
  );
}
