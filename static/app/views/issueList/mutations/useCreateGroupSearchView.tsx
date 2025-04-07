import {useMutation} from '@tanstack/react-query';

import {
  setApiQueryData,
  type UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

interface CreateGroupSearchViewData
  extends Partial<
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
        setApiQueryData<GroupSearchView[]>(
          queryClient,
          makeFetchGroupSearchViewsKey({
            orgSlug: organization.slug,
          }),
          existingViews => [...(existingViews ?? []), data]
        );
      }

      options?.onSuccess?.(data, variables, context);
    },
  });
}
