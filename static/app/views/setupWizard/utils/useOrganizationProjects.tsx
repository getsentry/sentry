import {skipToken, useQuery} from '@tanstack/react-query';

import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationProjects({
  organization,
  query,
}: {
  organization?: OrganizationWithRegion;
  query?: string;
}) {
  return useQuery({
    ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
      path: organization ? {organizationIdOrSlug: organization.slug} : skipToken,
      host: organization?.region.url,
      query: {query, collapse: ['latestDeploys', 'unusedFeatures']},
      staleTime: 0,
    }),
    refetchOnWindowFocus: true,
    retry: false,
  });
}
