import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {uniq} from 'sentry/utils/array/uniq';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {
  REPLAY_LIST_FIELDS,
  type ReplayListQueryReferrer,
  type ReplayListRecord,
} from 'sentry/views/replays/types';

type Options = {
  queryKey: NonNullable<ApiQueryKey | undefined>;
  queryReferrer: ReplayListQueryReferrer;
};

export default function useReplayList({queryKey, queryReferrer}: Options) {
  const fixedQueryKey = useMemo<ApiQueryKey>(() => {
    const [url, options] = queryKey;
    if (!options || !options.query) {
      return queryKey;
    }

    // HACK!!! Because the sort field needs to be in the eventView, but I cannot
    // ask the server for compound fields like `os.name`.
    const splitFields = REPLAY_LIST_FIELDS.map(field => field.split('.')[0]);
    const fields = uniq(splitFields);

    // when queryReferrer === 'issueReplays' we override the global view check on the backend
    // we also require a project param otherwise we won't yield results
    const {project: originalProject} = options.query;
    const project =
      queryReferrer === 'issueReplays' || queryReferrer === 'transactionReplays'
        ? ALL_ACCESS_PROJECTS
        : originalProject;
    return [
      url,
      {
        ...options,
        query: {
          per_page: 50,
          ...options.query,
          fields,
          project,
          queryReferrer,
        },
      },
    ];
  }, [queryKey, queryReferrer]);

  const {data, ...result} = useApiQuery<{data: any[]}>(fixedQueryKey, {
    staleTime: Infinity,
    enabled: true,
  });

  return {
    data: data?.data.map<ReplayListRecord>(mapResponseToReplayRecord),
    ...result,
  };
}
