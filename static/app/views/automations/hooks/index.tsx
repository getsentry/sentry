import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t, tn} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import type {
  DataConditionHandler,
  DataConditionHandlerGroupType,
} from 'sentry/types/workflowEngine/dataConditions';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export const makeAutomationsQueryKey = ({
  orgSlug,
  query,
  sortBy,
  ids,
  limit,
  cursor,
  projects,
}: {
  orgSlug: string;
  cursor?: string;
  ids?: string[];
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/`,
  {query: {query, sortBy, id: ids, per_page: limit, cursor, project: projects}},
];

const makeAutomationQueryKey = (orgSlug: string, automationId: string): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/${automationId}/`,
];

interface UseAutomationsQueryOptions {
  cursor?: string;
  ids?: string[];
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}
export function useAutomationsQuery(
  options: UseAutomationsQueryOptions = {},
  queryOptions: Partial<UseApiQueryOptions<Automation[]>> = {}
) {
  const {slug: orgSlug} = useOrganization();

  return useApiQuery<Automation[]>(makeAutomationsQueryKey({orgSlug, ...options}), {
    staleTime: 0,
    retry: false,
    ...queryOptions,
  });
}

export function useAutomationQuery(automationId: string) {
  const {slug} = useOrganization();

  return useApiQuery<Automation>(makeAutomationQueryKey(slug, automationId), {
    staleTime: 0,
    retry: false,
  });
}

export function useDataConditionsQuery(groupType: DataConditionHandlerGroupType) {
  const {slug} = useOrganization();

  return useApiQuery<DataConditionHandler[]>(
    [`/organizations/${slug}/data-conditions/`, {query: {group: groupType}}],
    {
      staleTime: Infinity,
      retry: false,
    }
  );
}

export function useAvailableActionsQuery() {
  const {slug} = useOrganization();

  return useApiQuery<ActionHandler[]>([`/organizations/${slug}/available-actions/`], {
    staleTime: Infinity,
    retry: false,
  });
}

export function useCreateAutomation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<Automation, void, NewAutomation>({
    mutationFn: data =>
      api.requestPromise(`/organizations/${org.slug}/workflows/`, {
        method: 'POST',
        data,
      }),
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
    },
    onError: _ => {
      AlertStore.addAlert({type: 'error', message: t('Unable to create automation')});
    },
  });
}

export function useUpdateAutomation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<Automation, void, {automationId: string} & NewAutomation>({
    mutationFn: ({automationId, ...data}) =>
      api.requestPromise(`/organizations/${org.slug}/workflows/${automationId}/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/${data.automationId}/`],
      });
    },
    onError: _ => {
      AlertStore.addAlert({type: 'error', message: t('Unable to update automation')});
    },
  });
}

export function useSendTestNotification() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<void, void, Array<Omit<Action, 'id'>>>({
    mutationFn: data =>
      api.requestPromise(`/organizations/${org.slug}/test-fire-actions/`, {
        method: 'POST',
        data: {actions: data},
      }),
    onSuccess: (_, variables, __) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
      addSuccessMessage(
        tn('Notification fired!', 'Notifications sent!', variables.length)
      );
    },
    onError: (_, variables, __) => {
      addErrorMessage(
        tn('Notification failed', 'Notifications failed', variables.length)
      );
    },
  });
}
