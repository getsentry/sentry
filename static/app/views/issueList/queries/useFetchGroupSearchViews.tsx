import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {
  GroupSearchView,
  GroupSearchViewCreatedBy,
} from 'sentry/views/issueList/types';

export type GroupSearchViewBackendSortOption =
  | 'visited'
  | '-visited'
  | 'popularity'
  | '-popularity'
  | 'name'
  | '-name'
  | 'created'
  | '-created';

type FetchGroupSearchViewsParameters = {
  orgSlug: string;
  createdBy?: GroupSearchViewCreatedBy;
  cursor?: string;
  limit?: number;
  query?: string;
  sort?: GroupSearchViewBackendSortOption[];
};

export function groupSearchViewsApiOptions({
  orgSlug,
  createdBy,
  limit,
  cursor,
  sort,
  query,
}: FetchGroupSearchViewsParameters) {
  return apiOptions.as<GroupSearchView[]>()(
    '/organizations/$organizationIdOrSlug/group-search-views/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {
        per_page: limit,
        createdBy,
        cursor,
        sort,
        query,
      },
      staleTime: Infinity,
    }
  );
}
