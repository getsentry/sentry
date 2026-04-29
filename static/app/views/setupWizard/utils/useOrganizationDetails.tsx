import {skipToken, useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationDetails({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  return useQuery({
    ...apiOptions.as<Organization>()('/organizations/$organizationIdOrSlug/', {
      path: organization ? {organizationIdOrSlug: organization.slug} : skipToken,
      host: organization?.region.url,
      query: {
        include_feature_flags: 1,
      },
      staleTime: 0,
    }),
    retry: false,
  });
}
