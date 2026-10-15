import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type {Simplify} from 'type-fest';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
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
  options?: UseMutationOptions<
    ApiResponse<GroupSearchView>,
    Error,
    CreateGroupSearchViewData
  >
) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Simplify<CreateGroupSearchViewData>) =>
      apiFetch<GroupSearchView>({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/group-search-views/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
          {method: 'POST', data},
        ],
      }),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      if (variables.starred) {
        const starredKey = starredGroupSearchViewsApiOptions({
          orgSlug: organization.slug,
        }).queryKey;
        queryClient.setQueryData(starredKey, prevData =>
          prevData ? {...prevData, json: [...prevData.json, data.json]} : prevData
        );
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
