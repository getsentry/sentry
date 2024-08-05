import {useMemo} from 'react';

import hydratedSelectorData from 'sentry/utils/replays/hydrateSelectorData';
import type {
  DeadRageSelectorItem,
  DeadRageSelectorListResponse,
} from 'sentry/views/replays/types';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchInfiniteApiData from '../../hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey, ApiResult} from '../../types';

interface Props {
  sort: '-count_dead_clicks' | '-count_rage_clicks';
}

export default function useInfiniteDeadClicksList({sort}: Props) {
  const {environment, organizationSlug, projectId} = useConfiguration();

  return useFetchInfiniteApiData<
    DeadRageSelectorListResponse,
    ApiResult<DeadRageSelectorItem[]>
  >({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/replay-selectors/`,
        {
          query: {
            per_page: 25,
            queryReferrer: 'devtoolbar',
            environment: Array.isArray(environment) ? environment : [environment],
            project: projectId,
            statsPeriod: '14d',
            query: '!count_dead_clicks:0',
            sort,
          },
        },
      ],
      [environment, organizationSlug, projectId, sort]
    ),

    select(data) {
      return {
        ...data,
        pages: data.pages.map(page => ({
          ...page,
          json: hydratedSelectorData(page.json.data, undefined),
        })),
      };
    },
  });
}
