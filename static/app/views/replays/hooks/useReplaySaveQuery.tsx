import {useCallback, useMemo} from 'react';

import type {DateString} from 'sentry/types/core';
import type {SavedQuery} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
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
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const requestData = useMemo((): Omit<ReplaySavedQueryRequest, 'name' | 'starred'> => {
    const {selection} = pageFilters;
    const {datetime, projects, environments} = selection;
    const {start, end, period} = datetime;

    return {
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

  const {mutateAsync} = useMutation<SavedQuery, Error, {name: string; starred?: boolean}>(
    {
      mutationFn: ({name, starred = true}) => {
        return fetchMutation<SavedQuery>({
          method: 'POST',
          url: `/organizations/${organization.slug}/explore/saved/`,
          data: {
            ...requestData,
            name,
            starred,
          },
        });
      },
      onSuccess: () => {
        invalidateSavedQueries();
      },
    }
  );

  const saveQuery = useCallback(
    (name: string, starred = true) => {
      return mutateAsync({name, starred});
    },
    [mutateAsync]
  );

  return {saveQuery};
}
