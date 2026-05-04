import {skipToken, useQuery} from '@tanstack/react-query';

import type {Team} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationTeams({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  return useQuery({
    ...apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
      path: organization ? {organizationIdOrSlug: organization.slug} : skipToken,
      host: organization?.region.url,
      staleTime: 0,
    }),
    refetchOnWindowFocus: true,
    retry: false,
  });
}
