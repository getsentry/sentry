import {queryOptions, skipToken} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseMutationOptions} from 'sentry/utils/queryClient';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

export const automationsApiOptions = (
  organization: Organization,
  options?: {
    cursor?: string;
    detector?: string[];
    ids?: string[];
    limit?: number;
    priorityDetector?: string;
    projects?: number[];
    query?: string;
    sortBy?: string;
  }
) => {
  const query = options
    ? {
        query: options.query,
        sortBy: options.sortBy,
        priorityDetector: options.priorityDetector,
        id: options.ids,
        per_page: options.limit,
        cursor: options.cursor,
        project: options.projects,
        detector: options.detector,
      }
    : undefined;

  return queryOptions({
    ...apiOptions.as<Automation[]>()('/organizations/$organizationIdOrSlug/workflows/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
      staleTime: 0,
    }),
    retry: false,
  });
};

const makeAutomationQueryKey = (orgSlug: string, automationId: string): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
    path: {organizationIdOrSlug: orgSlug, workflowId: automationId},
  }),
];

export function useAutomationQuery(automationId: string) {
  const {slug} = useOrganization();

  return useApiQuery<Automation>(makeAutomationQueryKey(slug, automationId), {
    staleTime: 0,
    retry: false,
  });
}

interface AutomationFireHistoryApiOptionsParams {
  automationId: string;
  organization: Organization;
  cursor?: string;
  limit?: number;
  query?: Record<string, any>;
}
export function automationFireHistoryApiOptions({
  automationId,
  cursor,
  limit,
  organization,
  query = {},
}: AutomationFireHistoryApiOptionsParams) {
  return queryOptions({
    ...apiOptions.as<AutomationFireHistory[]>()(
      '/organizations/$organizationIdOrSlug/workflows/$workflowId/group-history/',
      {
        path: automationId
          ? {organizationIdOrSlug: organization.slug, workflowId: automationId}
          : skipToken,
        query: {...query, per_page: limit, cursor},
        staleTime: 5 * 60 * 1000, // 5 minutes
      }
    ),
    retry: false,
  });
}

export function useDataConditionsQuery(groupType: DataConditionHandlerGroupType) {
  const {slug} = useOrganization();

  return useApiQuery<DataConditionHandler[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/data-conditions/', {
        path: {organizationIdOrSlug: slug},
      }),
      {query: {group: groupType}},
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );
}

export function useAvailableActionsQuery() {
  const {slug} = useOrganization();

  return useApiQuery<ActionHandler[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/available-actions/', {
        path: {organizationIdOrSlug: slug},
      }),
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );
}

export function useCreateAutomation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<Automation, RequestError, NewAutomation>({
    mutationFn: data =>
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/workflows/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        {
          method: 'POST',
          data,
        }
      ),
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
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
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
          path: {organizationIdOrSlug: org.slug, workflowId: automationId},
        }),
        {
          method: 'DELETE',
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
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
      return api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/workflows/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        {
          method: 'DELETE',
          query: {
            id: params.ids,
            query: params.query,
            project: params.projects,
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
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
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
          path: {organizationIdOrSlug: org.slug, workflowId: data.id},
        }),
        {
          method: 'PUT',
          data,
        }
      ),
    onSuccess: data => {
      // Update cache with new automation data
      setApiQueryData(
        queryClient,
        [
          getApiUrl('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
            path: {organizationIdOrSlug: org.slug, workflowId: data.id},
          }),
        ],
        data
      );
      // Invalidate list query
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
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
      return api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/workflows/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        {
          method: 'PUT',
          data: {enabled: params.enabled},
          query: {
            id: params.ids,
            query: params.query,
            project: params.projects,
          },
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
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
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/test-fire-actions/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        {
          method: 'POST',
          data: {actions: data},
        }
      ),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
      });
      addSuccessMessage(
        tn('Notification fired!', 'Notifications sent!', variables.length)
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      addErrorMessage(
        getWorkflowEngineResponseErrorMessage(error.responseJSON) ||
          tn('Notification failed', 'Notifications failed', variables.length)
      );
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
