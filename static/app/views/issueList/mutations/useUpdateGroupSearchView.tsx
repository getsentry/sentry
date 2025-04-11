import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  setApiQueryData,
  useMutation,
  type UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchGroupSearchViewKey} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import {makeFetchGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type UpdateGroupSearchViewVariables = Pick<
  GroupSearchView,
  'id' | 'name' | 'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
>;

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
    onSuccess: (data, parameters, context) => {
      // Update the specific view cache
      setApiQueryData<GroupSearchView>(
        queryClient,
        makeFetchGroupSearchViewKey({orgSlug: organization.slug, id: parameters.id}),
        data
      );

      // Update any matching starred views in cache
      setApiQueryData<GroupSearchView[]>(
        queryClient,
        makeFetchGroupSearchViewsKey({orgSlug: organization.slug}),
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
      options.onSuccess?.(data, parameters, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to update view'));
      options.onError?.(error, variables, context);
    },
  });
};
