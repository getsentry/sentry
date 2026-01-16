import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t, tn} from 'sentry/locale';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {
  Automation,
  AutomationFireHistory,
  NewAutomation,
} from 'sentry/types/workflowEngine/automations';
import type {
  DataConditionHandler,
  DataConditionHandlerGroupType,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  ApiQueryKey,
  UseApiQueryOptions,
  UseMutationOptions,
} from 'sentry/utils/queryClient';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export const makeAutomationsQueryKey = ({
  orgSlug,
  query,
  sortBy,
  priorityDetector,
  ids,
  limit,
  cursor,
  projects,
  detector,
}: {
  orgSlug: string;
  cursor?: string;
  detector?: string[];
  ids?: string[];
  limit?: number;
  priorityDetector?: string;
  projects?: number[];
  query?: string;
  sortBy?: string;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/`,
  {
    query: {
      query,
      sortBy,
      priorityDetector,
      id: ids,
      per_page: limit,
      cursor,
      project: projects,
      detector,
    },
  },
];

const makeAutomationQueryKey = (orgSlug: string, automationId: string): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/${automationId}/`,
];

interface UseAutomationsQueryOptions {
  cursor?: string;
  detector?: string[];
  ids?: string[];
  limit?: number;
  priorityDetector?: string;
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

const makeAutomationFireHistoryQueryKey = ({
  orgSlug,
  automationId,
  cursor,
  limit,
  query = {},
}: {
  automationId: string;
  orgSlug: string;
  cursor?: string;
  limit?: number;
  query?: Record<string, any>;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/${automationId}/group-history/`,
  {query: {...query, per_page: limit, cursor}},
];

interface UseAutomationFireHistoryQueryOptions {
  automationId: string;
  cursor?: string;
  limit?: number;
  query?: Record<string, any>;
}
export function useAutomationFireHistoryQuery(
  options: UseAutomationFireHistoryQueryOptions,
  queryOptions: Partial<UseApiQueryOptions<AutomationFireHistory[]>> = {}
) {
  const {slug} = useOrganization();

  return useApiQuery<AutomationFireHistory[]>(
    makeAutomationFireHistoryQueryKey({orgSlug: slug, ...options}),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
      ...queryOptions,
    }
  );
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

  return useMutation<Automation, RequestError, NewAutomation>({
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
      addErrorMessage(t('Unable to create alert'));
    },
  });
}

export function useDeleteAutomationMutation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<void, RequestError, string>({
    mutationFn: (automationId: string) =>
      api.requestPromise(`/organizations/${org.slug}/workflows/${automationId}/`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
      addSuccessMessage(t('Alert deleted'));
    },
    onError: error => {
      addErrorMessage(t('Unable to delete alert: %s', error.message));
    },
  });
}

/** Bulk delete automations */
export function useDeleteAutomationsMutation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<
    void,
    RequestError,
    {ids?: string[]; projects?: number[]; query?: string}
  >({
    mutationFn: params => {
      return api.requestPromise(`/organizations/${org.slug}/workflows/`, {
        method: 'DELETE',
        query: {
          id: params.ids,
          query: params.query,
          project: params.projects,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
      addSuccessMessage(t('Alerts deleted'));
    },
    onError: error => {
      addErrorMessage(t('Unable to delete alerts: %s', error.message));
    },
  });
}

export function useUpdateAutomation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<
    Automation,
    RequestError,
    Partial<NewAutomation> & {id: Automation['id']; name: NewAutomation['name']}
  >({
    mutationFn: data =>
      api.requestPromise(`/organizations/${org.slug}/workflows/${data.id}/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: data => {
      // Update cache with new automation data
      setApiQueryData(
        queryClient,
        [`/organizations/${org.slug}/workflows/${data.id}/`],
        data
      );
      // Invalidate list query
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
    },
    onError: _ => {
      addErrorMessage(t('Unable to update alert'));
    },
  });
}

/** Bulk update automations. Currently supports enabling/disabling automations. */
export function useUpdateAutomationsMutation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<
    void,
    RequestError,
    {enabled: boolean; ids?: string[]; projects?: number[]; query?: string}
  >({
    mutationFn: params => {
      return api.requestPromise(`/organizations/${org.slug}/workflows/`, {
        method: 'PUT',
        data: {enabled: params.enabled},
        query: {
          id: params.ids,
          query: params.query,
          project: params.projects,
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
      addSuccessMessage(variables.enabled ? t('Alerts enabled') : t('Alerts disabled'));
    },
    onError: (error, variables) => {
      addErrorMessage(
        t(
          'Unable to %s alerts: %2$s',
          variables.enabled ? t('enable') : t('disable'),
          error.message
        )
      );
    },
  });
}

export function useSendTestNotification(
  options?: UseMutationOptions<void, RequestError, Array<Omit<Action, 'id'>>>
) {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<void, RequestError, Array<Omit<Action, 'id'>>>({
    mutationFn: data =>
      api.requestPromise(`/organizations/${org.slug}/test-fire-actions/`, {
        method: 'POST',
        data: {actions: data},
      }),
    ...options,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/workflows/`],
      });
      addSuccessMessage(
        tn('Notification fired!', 'Notifications sent!', variables.length)
      );
      options?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const detail = error.responseJSON?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message;

      addErrorMessage(
        message || tn('Notification failed', 'Notifications failed', variables.length)
      );
      options?.onError?.(error, variables, context);
    },
  });
}
