import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type {Simplify} from 'type-fest';

import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

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
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Simplify<CreateGroupSearchViewData>) =>
      fetchMutation<GroupSearchView>({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'POST',
        data,
      }),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      if (variables.starred) {
        const starredKey = starredGroupSearchViewsApiOptions({
          orgSlug: organization.slug,
        }).queryKey;
        queryClient.setQueryData(starredKey, prevData =>
          prevData ? {...prevData, json: [...prevData.json, data]} : prevData
        );
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
