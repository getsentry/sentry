import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type ReleaseMetaBasic = {
  date: string;
  version: string;
};

type ReleaseConditions = {
  datetime: PageFilters['datetime'];
  environment: readonly string[];
  project?: readonly number[];
  query?: string;
};

export function useReleaseStats({
  datetime,
  environment,
  project,
  query,
}: ReleaseConditions) {
  const organization = useOrganization();
  const results = useApiQuery<ReleaseMetaBasic[]>(
    [
      `/organizations/${organization.slug}/releases/stats/`,
      {
        query: {
          environment,
          project,
          query,
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  return {
    ...results,
    releases:
      !results.isLoading && results.data
        ? results.data.map(release => ({
            timestamp: release.date,
            version: release.version,
          }))
        : undefined,
  };
}
