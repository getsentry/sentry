import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import hydratedSelectorData from 'sentry/utils/replays/hydrateSelectorData';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  DeadRageSelectorListResponse,
  DeadRageSelectorQueryParams,
} from 'sentry/views/replays/types';

export default function useDeadRageSelectors(params: DeadRageSelectorQueryParams) {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  const {isPending, isError, error, data, getResponseHeader} =
    useApiQuery<DeadRageSelectorListResponse>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/replay-selectors/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          query: {
            query: '!count_dead_clicks:0',
            cursor: params.cursor,
            environment: decodeList(query.environment),
            project: query.project,
            statsPeriod: query.statsPeriod,
            start: decodeScalar(query.start),
            end: decodeScalar(query.end),
            per_page: params.per_page,
            sort: query[params.prefix + 'sort'] ?? params.sort,
          },
        },
      ],
      {staleTime: Infinity, enabled: params.enabled}
    );

  return {
    isLoading: isPending,
    isError,
    error,
    data: hydratedSelectorData(
      data ? data.data : [],
      params.isWidgetData ? params.sort?.replace(/^-/, '') : null
    ),
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
