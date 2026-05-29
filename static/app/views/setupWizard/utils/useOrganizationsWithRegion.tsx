import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';

import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {OrganizationSummaryWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationsWithRegion() {
  const {memberRegions, links} = useLegacyStore(ConfigStore);

  const query = useQuery({
    ...apiOptions.as<OrganizationSummary[]>()('/organizations/', {
      host: links.sentryUrl, // request from control silo
      staleTime: 0,
    }),
    refetchOnWindowFocus: false,
    retry: false,
    select: response => {
      const regionByUrl = new Map(memberRegions.map(region => [region.url, region]));
      return response.json.flatMap((org): OrganizationSummaryWithRegion[] => {
        const region = regionByUrl.get(org.links.regionUrl);
        if (!region) {
          // This is not expected to happen, but log it so we can diagnose if
          // an organization's region is missing from the member regions.
          Sentry.captureMessage(
            'Could not match organization region URL to a member region',
            {
              level: 'warning',
              extra: {
                organizationSlug: org.slug,
                regionUrl: org.links.regionUrl,
              },
            }
          );
          return [];
        }
        return [{...org, region} as OrganizationSummaryWithRegion];
      });
    },
  });

  return {
    data: query.data ?? [],
    isError: query.isError,
    isPending: query.isPending,
  };
}
