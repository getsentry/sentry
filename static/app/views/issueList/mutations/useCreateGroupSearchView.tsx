import {useMutation} from '@tanstack/react-query';

import {
  setApiQueryData,
  useQueryClient,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {GroupSearchView, StarredGroupSearchView} from 'sentry/views/issueList/types';

interface CreateGroupSearchViewData extends Partial<
  Pick<
    GroupSearchView,
    'name' | 'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
  >
> {
  starred?: boolean;
}

export function useCreateGroupSearchView(
  options?: UseMutationOptions<GroupSearchView, Error, CreateGroupSearchViewData>
) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupSearchViewData) =>
      api.requestPromise(`/organizations/${organization.slug}/group-search-views/`, {
        method: 'POST',
        data,
      }),
    ...options,
    onSuccess: (data, variables, context) => {
      if (variables.starred) {
        setApiQueryData<StarredGroupSearchView[]>(
          queryClient,
          makeFetchStarredGroupSearchViewsKey({
            orgSlug: organization.slug,
          }),
          existingViews => [...(existingViews ?? []), data]
        );
      }

      options?.onSuccess?.(data, variables, context);
    },
  });
}
