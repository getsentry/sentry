import {useCallback} from 'react';

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
  organization: OrganizationSummary | null;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
};

/**
 * Raw response data from the endpoint
 */
export type PromptResponseItem = {
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
  features?: {[key: string]: PromptResponseItem};
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
    organization_id: params.organization?.id,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };
  const url = `/organizations/${params.organization?.slug}/prompts-activity/`;
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
}: PromptCheckParams): ApiQueryKey => {
  const url = `/organizations/${organization?.slug}/prompts-activity/`;
  return [
    url,
    {query: {feature, organization_id: organization?.id, project_id: projectId}},
  ];
};

export function usePromptsCheck(
  {feature, organization, projectId}: PromptCheckParams,
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
        const dimissedTs = new Date().getTime() / 1000;
        return {
          data: {dismissed_ts: dimissedTs},
          features: {[feature]: {dismissed_ts: dimissedTs}},
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
        const snoozedTs = new Date().getTime() / 1000;
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
): Promise<{[key in T[number]]: PromptData}> {
  const query = {
    feature: features,
    organization_id: params.organization.id,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };
  const url = `/organizations/${params.organization.slug}/prompts-activity/`;
  const response: PromptResponse = await api.requestPromise(url, {
    query,
  });
  const responseFeatures = response?.features;

  const result: {[key in T[number]]?: PromptData} = {};
  if (!responseFeatures) {
    return result as {[key in T[number]]: PromptData};
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
  return result as {[key in T[number]]: PromptData};
}
