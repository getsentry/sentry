import {useCallback, useMemo} from 'react';

import type {Client} from 'sentry/api';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type PromptsUpdateParams = {
  /**
   * The prompt feature name
   */
  feature: string;
  organization: OrganizationSummary;
  status: 'snoozed' | 'dismissed' | 'visible';
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
};

/**
 * Update the status of a prompt
 */
export function promptsUpdate(api: Client, params: PromptsUpdateParams) {
  const url = `/organizations/${params.organization.slug}/prompts-activity/`;
  return api.requestPromise(url, {
    method: 'PUT',
    data: {
      organization_id: params.organization.id,
      project_id: params.projectId,
      feature: params.feature,
      status: params.status,
    },
  });
}

type PromptCheckParams = {
  /**
   * The prompt feature name
   */
  feature: string | string[];
  organization: OrganizationSummary;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
};

type PromptCheckHookParams = {
  feature: string | string[];
  organization: OrganizationSummary | null;
  projectId?: string;
};

/**
 * Raw response data from the endpoint
 */
type PromptResponseItem = {
  /**
   * Time since dismissed
   */
  dismissed_ts?: number;
  /**
   * Time since snoozed
   */
  snoozed_ts?: number;
};
export type PromptResponse = {
  data?: PromptResponseItem;
  features?: Record<string, PromptResponseItem>;
};

/**
 * Processed endpoint response data
 */
export type PromptData = null | {
  /**
   * Time since dismissed
   */
  dismissedTime?: number;
  /**
   * Time since snoozed
   */
  snoozedTime?: number;
};

/**
 * Get the status of a prompt
 */
export async function promptsCheck(
  api: Client,
  params: PromptCheckParams
): Promise<PromptData> {
  const query = {
    feature: params.feature,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };
  const url = `/organizations/${params.organization.slug}/prompts-activity/`;
  const response: PromptResponse = await api.requestPromise(url, {
    query,
  });

  if (response?.data) {
    return {
      dismissedTime: response.data.dismissed_ts,
      snoozedTime: response.data.snoozed_ts,
    };
  }

  return null;
}

export const makePromptsCheckQueryKey = ({
  feature,
  organization,
  projectId,
}: PromptCheckHookParams): ApiQueryKey => {
  const url = `/organizations/${organization?.slug}/prompts-activity/`;
  return [url, {query: {feature, project_id: projectId}}];
};

export function usePromptsCheck(
  {feature, organization, projectId}: PromptCheckHookParams,
  {enabled = true, ...options}: Partial<UseApiQueryOptions<PromptResponse>> = {}
) {
  return useApiQuery<PromptResponse>(
    makePromptsCheckQueryKey({feature, organization, projectId}),
    {
      staleTime: 120000,
      retry: false,
      enabled: defined(organization) && enabled,
      ...options,
    }
  );
}

/**
 * Get the status of many prompts in a single query
 */
export function usePrompts({
  features,
  organization,
  projectId,
  daysToSnooze,
  options,
  isDismissed = promptIsDismissed,
}: {
  features: string[];
  organization: Organization | null;
  daysToSnooze?: number;
  isDismissed?: (prompt: PromptData, daysToSnooze?: number) => boolean;
  options?: Partial<UseApiQueryOptions<PromptResponse>>;
  projectId?: string;
}) {
  const api = useApi({persistInFlight: true});
  const prompts = usePromptsCheck({feature: features, organization, projectId}, options);
  const queryClient = useQueryClient();
  const isPromptDismissed: Record<string, boolean> = useMemo(() => {
    if (prompts.isSuccess) {
      return features.reduce(
        (acc, feature) => {
          const prompt = prompts.data.features?.[feature];
          acc[feature] = isDismissed(
            {dismissedTime: prompt?.dismissed_ts, snoozedTime: prompt?.snoozed_ts},
            daysToSnooze
          );
          return acc;
        },
        {} as Record<string, boolean>
      );
    }
    return {};
  }, [prompts.isSuccess, prompts.data?.features, features, daysToSnooze, isDismissed]);

  const dismissPrompt = useCallback(
    (feature: string) => {
      if (!organization) {
        return;
      }
      promptsUpdate(api, {
        organization,
        projectId,
        feature,
        status: 'dismissed',
      });

      // Update cached query data
      // Will set prompt to dismissed
      setApiQueryData<PromptResponse>(
        queryClient,
        makePromptsCheckQueryKey({
          organization,
          feature: features,
          projectId,
        }),
        existingData => {
          const dismissedTs = Date.now() / 1000;
          return {
            data: {dismissed_ts: dismissedTs},
            features: {...existingData?.features, [feature]: {dismissed_ts: dismissedTs}},
          };
        }
      );
    },
    [api, organization, projectId, queryClient, features]
  );

  const snoozePrompt = useCallback(
    (feature: string) => {
      if (!organization) {
        return;
      }
      promptsUpdate(api, {
        organization,
        projectId,
        feature,
        status: 'snoozed',
      });

      // Update cached query data
      // Will set prompt to snoozed
      setApiQueryData<PromptResponse>(
        queryClient,
        makePromptsCheckQueryKey({
          organization,
          feature: features,
          projectId,
        }),
        existingData => {
          const snoozedTs = Date.now() / 1000;
          return {
            data: {snoozed_ts: snoozedTs},
            features: {...existingData?.features, [feature]: {snoozed_ts: snoozedTs}},
          };
        }
      );
    },
    [api, organization, projectId, queryClient, features]
  );

  const showPrompt = useCallback(
    (feature: string) => {
      if (!organization) {
        return;
      }
      promptsUpdate(api, {
        organization,
        projectId,
        feature,
        status: 'visible',
      });

      // Update cached query data
      // Will clear the status/timestamps of a prompt that is dismissed or snoozed
      setApiQueryData<PromptResponse>(
        queryClient,
        makePromptsCheckQueryKey({
          organization,
          feature: features,
          projectId,
        }),
        existingData => {
          return {
            data: {},
            features: {...existingData?.features, [feature]: {}},
          };
        }
      );
    },
    [api, organization, projectId, queryClient, features]
  );

  return {
    isLoading: prompts.isPending,
    isError: prompts.isError,
    isPromptDismissed,
    dismissPrompt,
    snoozePrompt,
    showPrompt,
  };
}

export function usePrompt({
  feature,
  organization,
  projectId,
  daysToSnooze,
  options,
}: {
  feature: string;
  organization: Organization | null;
  daysToSnooze?: number;
  options?: Partial<UseApiQueryOptions<PromptResponse>>;
  projectId?: string;
}) {
  const api = useApi({persistInFlight: true});
  const prompt = usePromptsCheck({feature, organization, projectId}, options);
  const queryClient = useQueryClient();

  const isPromptDismissed = prompt.isSuccess
    ? promptIsDismissed(
        {
          dismissedTime: prompt.data?.data?.dismissed_ts,
          snoozedTime: prompt.data?.data?.snoozed_ts,
        },
        daysToSnooze
      )
    : undefined;

  const dismissPrompt = useCallback(() => {
    if (!organization) {
      return;
    }

    promptsUpdate(api, {
      organization,
      projectId,
      feature,
      status: 'dismissed',
    });

    // Update cached query data
    // Will set prompt to dismissed
    setApiQueryData<PromptResponse>(
      queryClient,
      makePromptsCheckQueryKey({
        organization,
        feature,
        projectId,
      }),
      () => {
        const dismissedTs = Date.now() / 1000;
        return {
          data: {dismissed_ts: dismissedTs},
          features: {[feature]: {dismissed_ts: dismissedTs}},
        };
      }
    );
  }, [api, feature, organization, projectId, queryClient]);

  const snoozePrompt = useCallback(() => {
    if (!organization) {
      return;
    }
    promptsUpdate(api, {
      organization,
      projectId,
      feature,
      status: 'snoozed',
    });

    // Update cached query data
    // Will set prompt to snoozed
    setApiQueryData<PromptResponse>(
      queryClient,
      makePromptsCheckQueryKey({
        organization,
        feature,
        projectId,
      }),
      () => {
        const snoozedTs = Date.now() / 1000;
        return {
          data: {snoozed_ts: snoozedTs},
          features: {[feature]: {snoozed_ts: snoozedTs}},
        };
      }
    );
  }, [api, feature, organization, projectId, queryClient]);

  const showPrompt = useCallback(() => {
    if (!organization) {
      return;
    }
    promptsUpdate(api, {
      organization,
      projectId,
      feature,
      status: 'visible',
    });

    // Update cached query data
    // Will clear the status/timestamps of a prompt that is dismissed or snoozed
    setApiQueryData<PromptResponse>(
      queryClient,
      makePromptsCheckQueryKey({
        organization,
        feature,
        projectId,
      }),
      () => {
        return {
          data: {},
          features: {[feature]: {}},
        };
      }
    );
  }, [api, feature, organization, projectId, queryClient]);

  return {
    isLoading: prompt.isPending,
    isError: prompt.isError,
    data: prompt.data?.data,
    isPromptDismissed,
    dismissPrompt,
    snoozePrompt,
    showPrompt,
  };
}

/**
 * Get the status of many prompts
 */
export async function batchedPromptsCheck<T extends readonly string[]>(
  api: Client,
  features: T,
  params: {
    organization: OrganizationSummary;
    projectId?: string;
  }
): Promise<Record<T[number], PromptData>> {
  const query = {
    feature: features,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };
  const url = `/organizations/${params.organization.slug}/prompts-activity/`;
  const response: PromptResponse = await api.requestPromise(url, {
    query,
  });
  const responseFeatures = response?.features;

  const result: Partial<Record<T[number], PromptData>> = {};
  if (!responseFeatures) {
    return result as Record<T[number], PromptData>;
  }
  for (const featureName of features) {
    const item = responseFeatures[featureName];
    if (item) {
      (result as any)[featureName] = {
        dismissedTime: item.dismissed_ts,
        snoozedTime: item.snoozed_ts,
      };
    } else {
      (result as any)[featureName] = null;
    }
  }
  return result as Record<T[number], PromptData>;
}
