import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';

type FetchStarredGroupSearchViewsParameters = {
  orgSlug: string;
};

export const makeFetchStarredGroupSearchViewsKey = ({
  orgSlug,
}: FetchStarredGroupSearchViewsParameters): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/group-search-views/starred/', {
    path: {organizationIdOrSlug: orgSlug},
  }),
];
