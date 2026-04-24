import {useQueryClient} from '@tanstack/react-query';
import {useMutation} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupSearchViewApiOptions} from 'sentry/views/issueList/queries/groupSearchView';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type UpdateGroupSearchViewVariables = Pick<
  GroupSearchView,
  'id' | 'name' | 'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
> & {
  optimistic?: boolean;
};

export const useUpdateGroupSearchView = (
  options: {onSuccess?: (data: GroupSearchView) => void} = {}
) => {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const starredKey = starredGroupSearchViewsApiOptions({
    orgSlug: organization.slug,
  }).queryKey;

  return useMutation({
    mutationFn: ({id, ...groupSearchView}: UpdateGroupSearchViewVariables) =>
      fetchMutation<GroupSearchView>({
        url: `/organizations/${organization.slug}/group-search-views/${id}/`,
        method: 'PUT',
        data: groupSearchView,
      }),
    onMutate: variables => {
      const {optimistic, ...viewParams} = variables;
      if (optimistic) {
        const viewKey = groupSearchViewApiOptions({
          orgSlug: organization.slug,
          id: viewParams.id,
        }).queryKey;

        // Update the specific view cache
        queryClient.setQueryData(viewKey, prevData =>
          prevData ? {...prevData, json: {...prevData.json, ...viewParams}} : prevData
        );

        // Update any matching starred views in cache
        queryClient.setQueryData(starredKey, prevData =>
          prevData
            ? {
                ...prevData,
                json: prevData.json.map(view =>
                  view.id === variables.id ? {...view, ...variables} : view
                ),
              }
            : prevData
        );
      }
    },
    onSuccess: (data, variables) => {
      if (!variables.optimistic) {
        const viewKey = groupSearchViewApiOptions({
          orgSlug: organization.slug,
          id: variables.id,
        }).queryKey;

        // Update the specific view cache
        queryClient.setQueryData(viewKey, prevData =>
          prevData ? {...prevData, json: data} : prevData
        );

        // Update any matching starred views in cache
        queryClient.setQueryData(starredKey, prevData =>
          prevData
            ? {
                ...prevData,
                json: prevData.json.map(view =>
                  view.id === variables.id ? {...view, ...variables} : view
                ),
              }
            : prevData
        );
      }
      options.onSuccess?.(data);
    },
    onError: () => {
      addErrorMessage(t('Failed to update view'));
    },
  });
};
