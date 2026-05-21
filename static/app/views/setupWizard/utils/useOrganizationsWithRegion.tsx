import {queryOptions, useQueries} from '@tanstack/react-query';

import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function useOrganizationsWithRegion() {
  const {memberRegions} = useLegacyStore(ConfigStore);

  return useQueries({
    queries: memberRegions.map(region =>
      queryOptions({
        ...apiOptions.as<Organization[]>()('/organizations/', {
          host: region.url,
          // Authentication errors can happen as we span regions.
          allowAuthError: true,
          staleTime: 0,
        }),
        refetchOnWindowFocus: false,
        retry: false,
        select: response =>
          response.json.map(org => ({
            ...org,
            region,
          })),
      })
    ),
    combine: results => {
      return {
        data: results.flatMap(r => r.data ?? []),
        isError: results.some(r => r.isError),
        isPending: results.some(r => r.isPending),
      };
    },
  });
}
