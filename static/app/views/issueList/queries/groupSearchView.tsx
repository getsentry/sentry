import {queryOptions} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type FetchGroupSearchViewsParameters = {
  id: string | number;
  orgSlug: string;
};

export function groupSearchViewApiOptions({
  id,
  orgSlug,
}: FetchGroupSearchViewsParameters) {
  return queryOptions({
    ...apiOptions.as<GroupSearchView>()(
      '/organizations/$organizationIdOrSlug/group-search-views/$viewId/',
      {
        path: {organizationIdOrSlug: orgSlug, viewId: id},
        staleTime: 30_000,
      }
    ),
    retry: false,
  });
}
