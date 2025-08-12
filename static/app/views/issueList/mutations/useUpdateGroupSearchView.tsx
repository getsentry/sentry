import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  setApiQueryData,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchGroupSearchViewKey} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {GroupSearchView, StarredGroupSearchView} from 'sentry/views/issueList/types';

type UpdateGroupSearchViewVariables = Pick<
  GroupSearchView,
  'id' | 'name' | 'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
> & {
  optimistic?: boolean;
};

export const useUpdateGroupSearchView = (
  options: Omit<
    UseMutationOptions<GroupSearchView, RequestError, UpdateGroupSearchViewVariables>,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<GroupSearchView, RequestError, UpdateGroupSearchViewVariables>({
    ...options,
    mutationFn: ({id, ...groupSearchView}: UpdateGroupSearchViewVariables) =>
      api.requestPromise(
        `/organizations/${organization.slug}/group-search-views/${id}/`,
        {
          method: 'PUT',
          data: groupSearchView,
        }
      ),

    onMutate: variables => {
      const {optimistic, ...viewParams} = variables;
      if (optimistic) {
        // Update the specific view cache
        setApiQueryData<GroupSearchView>(
          queryClient,
          makeFetchGroupSearchViewKey({orgSlug: organization.slug, id: viewParams.id}),
          oldView => (oldView ? {...oldView, ...viewParams} : oldView)
        );

        // Update any matching starred views in cache
        setApiQueryData<StarredGroupSearchView[]>(
          queryClient,
          makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
          oldGroupSearchViews => {
            return (
              oldGroupSearchViews?.map(view => {
                if (view.id === variables.id) {
                  return {...view, ...variables};
                }
                return view;
              }) ?? []
            );
          }
        );
      }
      options.onMutate?.(variables);
    },
    onSuccess: (data, parameters, context) => {
      if (!parameters.optimistic) {
        // Update the specific view cache
        setApiQueryData<GroupSearchView>(
          queryClient,
          makeFetchGroupSearchViewKey({orgSlug: organization.slug, id: parameters.id}),
          data
        );

        // Update any matching starred views in cache
        setApiQueryData<StarredGroupSearchView[]>(
          queryClient,
          makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
          oldGroupSearchViews => {
            return (
              oldGroupSearchViews?.map(view => {
                if (view.id === parameters.id) {
                  return {...view, ...parameters};
                }
                return view;
              }) ?? []
            );
          }
        );
      }
      options.onSuccess?.(data, parameters, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to update view'));
      options.onError?.(error, variables, context);
    },
  });
};
