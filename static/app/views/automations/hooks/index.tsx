import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {
  Automation,
  AutomationFireHistory,
  AutomationType,
  NewAutomation,
} from 'sentry/types/workflowEngine/automations';
import type {
  DataConditionHandler,
  DataConditionHandlerGroupType,
} from 'sentry/types/workflowEngine/dataConditions';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

// All user-facing alert pages only ask for "alert" workflows
const ALERT_AUTOMATION_TYPE: AutomationType = 'alert';

export const automationsApiOptions = (
  organization: Organization,
  options?: {
    cursor?: string;
    detector?: string[];
    ids?: string[];
    limit?: number;
    projects?: number[];
    query?: string;
    sortBy?: string;
  }
) => {
  return queryOptions({
    ...apiOptions.as<Automation[]>()('/organizations/$organizationIdOrSlug/workflows/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        type: ALERT_AUTOMATION_TYPE,
        query: options?.query,
        sortBy: options?.sortBy,
        id: options?.ids,
        per_page: options?.limit,
        cursor: options?.cursor,
        project: options?.projects,
        detector: options?.detector,
      },
      staleTime: 0,
    }),
    retry: false,
  });
};

const automationApiOptions = (orgSlug: string, automationId: string) =>
  apiOptions.as<Automation>()(
    '/organizations/$organizationIdOrSlug/workflows/$workflowId/',
    {path: {organizationIdOrSlug: orgSlug, workflowId: automationId}, staleTime: 0}
  );

export function useAutomationQuery(automationId: string) {
  const {slug} = useOrganization();

  return useQuery({
    ...automationApiOptions(slug, automationId),
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

  return useQuery({
    ...apiOptions.as<DataConditionHandler[]>()(
      '/organizations/$organizationIdOrSlug/data-conditions/',
      {path: {organizationIdOrSlug: slug}, query: {group: groupType}, staleTime: Infinity}
    ),
    retry: false,
  });
}

export function useAvailableActionsQuery() {
  const {slug} = useOrganization();

  return useQuery({
    ...apiOptions.as<ActionHandler[]>()(
      '/organizations/$organizationIdOrSlug/available-actions/',
      {path: {organizationIdOrSlug: slug}, staleTime: Infinity}
    ),
    retry: false,
  });
}

export function useCreateAutomation({
  suppressErrorMessage = false,
}: {suppressErrorMessage?: boolean} = {}) {
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
    onError: error => {
      if (suppressErrorMessage) {
        return;
      }
      toast.error(
        getWorkflowEngineResponseErrorMessage(error.responseJSON) ??
          t('Unable to create alert')
      );
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
      toast.success(t('Alert deleted'));
    },
    onError: error => {
      toast.error(t('Unable to delete alert: %s', error.message));
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
            type: ALERT_AUTOMATION_TYPE,
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
      });
      toast.success(t('Alerts deleted'));
    },
    onError: error => {
      toast.error(t('Unable to delete alerts: %s', error.message));
    },
  });
}

export function useUpdateAutomation({
  suppressErrorMessage = false,
}: {suppressErrorMessage?: boolean} = {}) {
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
      queryClient.setQueryData(
        automationApiOptions(org.slug, data.id).queryKey,
        previous => ({...previous, json: data, headers: previous?.headers ?? {}})
      );
      // Invalidate list query
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
      });
    },
    onError: error => {
      if (suppressErrorMessage) {
        return;
      }
      toast.error(
        getWorkflowEngineResponseErrorMessage(error.responseJSON) ??
          t('Unable to update alert')
      );
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
            type: ALERT_AUTOMATION_TYPE,
          },
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
      });
      toast.success(variables.enabled ? t('Alerts enabled') : t('Alerts disabled'));
    },
    onError: (error, variables) => {
      toast.error(
        t(
          'Unable to %s alerts: %2$s',
          variables.enabled ? t('enable') : t('disable'),
          error.message
        )
      );
    },
  });
}

interface SendTestNotificationVariables {
  actions: Array<Omit<Action, 'id'>>;
  projectSlug?: string;
}

export function useSendTestNotification(
  options?: UseMutationOptions<void, RequestError, SendTestNotificationVariables>
) {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<void, RequestError, SendTestNotificationVariables>({
    mutationFn: ({actions, projectSlug}) =>
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/test-fire-actions/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        {
          method: 'POST',
          data: {actions, projectSlug},
        }
      ),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: automationsApiOptions(org).queryKey,
      });
      toast.success(
        tn('Notification fired!', 'Notifications sent!', variables.actions.length)
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(
        getWorkflowEngineResponseErrorMessage(error.responseJSON) ||
          tn('Notification failed', 'Notifications failed', variables.actions.length)
      );
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
