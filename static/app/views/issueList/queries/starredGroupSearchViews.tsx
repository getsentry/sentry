import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {StarredGroupSearchView} from 'sentry/views/issueList/types';

type FetchStarredGroupSearchViewsParameters = {
  orgSlug: string;
};

export function starredGroupSearchViewsApiOptions({
  orgSlug,
}: FetchStarredGroupSearchViewsParameters) {
  return apiOptions.as<StarredGroupSearchView[]>()(
    '/organizations/$organizationIdOrSlug/group-search-views/starred/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    }
  );
}
