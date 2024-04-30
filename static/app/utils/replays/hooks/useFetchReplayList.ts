import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {Organization} from 'sentry/types/organization';
import {uniq} from 'sentry/utils/array/uniq';
import {
  type ApiQueryKey,
  type QueryKeyEndpointOptions,
  useApiQuery,
} from 'sentry/utils/queryClient';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {
  REPLAY_LIST_FIELDS,
  type ReplayListQueryReferrer,
  type ReplayListRecord,
} from 'sentry/views/replays/types';

interface QueryOptions {
  cursor?: string;
  end?: string;
  environment?: string[];
  project?: string[];
  query?: string;
  sort?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type Options = {
  options: QueryKeyEndpointOptions<Record<string, string>, QueryOptions, never>;
  organization: Organization;
  queryReferrer: ReplayListQueryReferrer;
};

export default function useFetchReplayList({
  options,
  organization,
  queryReferrer,
}: Options) {
  const fixedQueryKey = useMemo<ApiQueryKey>(() => {
    const url = `/organizations/${organization.slug}/replays/`;
    if (!options || !options.query) {
      return [url];
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

    const query = Object.fromEntries(
      Object.entries(options.query).filter(([_key, val]) => val !== '')
    );
    return [
      url,
      {
        ...options,
        query: {
          per_page: 50,
          ...query,
          fields,
          project,
          queryReferrer,
        },
      },
    ];
  }, [options, organization.slug, queryReferrer]);

  const {data, ...result} = useApiQuery<{data: any[]}>(fixedQueryKey, {
    staleTime: 0,
    enabled: true,
  });

  return {
    data: data?.data?.map<ReplayListRecord>(mapResponseToReplayRecord),
    ...result,
  };
}
