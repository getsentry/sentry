import {useQuery} from '@tanstack/react-query';

import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

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
      return response.json.flatMap((org): OrganizationWithRegion[] => {
        const region = regionByUrl.get(org.links.regionUrl);
        if (!region) {
          return [];
        }
        return [{...org, region} as OrganizationWithRegion];
      });
    },
  });

  return {
    data: query.data ?? [],
    isError: query.isError,
    isPending: query.isPending,
  };
}
