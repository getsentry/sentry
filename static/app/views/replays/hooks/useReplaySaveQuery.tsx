import {useCallback, useMemo} from 'react';

import type {DateString} from 'sentry/types/core';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';

type ReplaySavedQueryRequest = {
  dataset: 'replays';
  name: string;
  projects: number[];
  end?: DateString;
  environment?: string[];
  query?: Array<{
    mode?: Mode;
    query?: string;
  }>;
  range?: string;
  starred?: boolean;
  start?: DateString;
};

export function useReplaySaveQuery(query: string) {
  const api = useApi();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const requestData = useMemo((): ReplaySavedQueryRequest => {
    const {selection} = pageFilters;
    const {datetime, projects, environments} = selection;
    const {start, end, period} = datetime;

    return {
      name: '',
      projects,
      dataset: 'replays',
      start,
      end,
      range: period ?? undefined,
      environment: environments,
      query: [
        {
          mode: Mode.SAMPLES,
          query,
        },
      ],
    };
  }, [pageFilters, query]);

  const saveQuery = useCallback(
    async (name: string, starred = true) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            ...requestData,
            name,
            starred,
          },
        }
      );
      invalidateSavedQueries();
      return response;
    },
    [api, organization.slug, requestData, invalidateSavedQueries]
  );

  return {saveQuery};
}
