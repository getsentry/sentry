import {useCallback, useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import type {Client} from 'sentry/api';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import {useApi} from 'sentry/utils/useApi';

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
  const url = getApiUrl('/organizations/$organizationIdOrSlug/prompts-activity/', {
    path: {organizationIdOrSlug: params.organization.slug},
  });
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
type PromptResponse = {
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

const makePromptsCheckApiOptions = ({
  feature,
  organization,
  projectId,
}: PromptCheckHookParams) => {
  return apiOptions.as<PromptResponse>()(
    '/organizations/$organizationIdOrSlug/prompts-activity/',
    {
      path: {organizationIdOrSlug: organization?.slug!},
      query: {feature, project_id: projectId},
      staleTime: 120000,
    }
  );
};

function usePromptsCheck(
  {feature, organization, projectId}: PromptCheckHookParams,
  {enabled = true}: PromptQueryOptions = {}
) {
  return useQuery({
    ...makePromptsCheckApiOptions({feature, organization, projectId}),
    retry: false,
    enabled: defined(organization) && enabled,
  });
}

/**
 * Get the status of many prompts in a single query
 */
export function usePrompts({
  features,
  organization,
  daysToSnooze,
  options,
  isDismissed = promptIsDismissed,
}: {
  features: string[];
  organization: Organization | null;
  daysToSnooze?: number;
  isDismissed?: (prompt: PromptData, daysToSnooze?: number) => boolean;
  options?: PromptQueryOptions;
}) {
  const api = useApi({persistInFlight: true});
  const prompts = usePromptsCheck({feature: features, organization}, options);
  const queryClient = useQueryClient();
  const isPromptDismissed = useMemo(() => {
    if (prompts.isSuccess) {
      return features.reduce<Record<string, boolean>>((acc, feature) => {
        const prompt = prompts.data.features?.[feature];
        acc[feature] = isDismissed(
          {dismissedTime: prompt?.dismissed_ts, snoozedTime: prompt?.snoozed_ts},
          daysToSnooze
        );
        return acc;
      }, {});
    }
    return {};
  }, [prompts.isSuccess, prompts.data, features, daysToSnooze, isDismissed]);

  const dismissPrompt = useCallback(
    (feature: string) => {
      if (!organization) {
        return;
      }
      promptsUpdate(api, {
        organization,
        feature,
        status: 'dismissed',
      });

      // Update cached query data
      // Will set prompt to dismissed
      queryClient.setQueryData(
        makePromptsCheckApiOptions({
          organization,
          feature: features,
        }).queryKey,
        previous => {
          const existingData = previous?.json;

          const dismissedTs = Date.now() / 1000;
          return {
            ...previous,
            headers: previous?.headers ?? {},
            json: {
              data: {dismissed_ts: dismissedTs},
              features: {
                ...existingData?.features,
                [feature]: {dismissed_ts: dismissedTs},
              },
            },
          };
        }
      );
    },
    [api, organization, queryClient, features]
  );

  const snoozePrompt = useCallback(
    (feature: string) => {
      if (!organization) {
        return;
      }
      promptsUpdate(api, {
        organization,
        feature,
        status: 'snoozed',
      });

      // Update cached query data
      // Will set prompt to snoozed
      queryClient.setQueryData(
        makePromptsCheckApiOptions({
          organization,
          feature: features,
        }).queryKey,
        previous => {
          const existingData = previous?.json;

          const snoozedTs = Date.now() / 1000;
          return {
            ...previous,
            headers: previous?.headers ?? {},
            json: {
              data: {snoozed_ts: snoozedTs},
              features: {...existingData?.features, [feature]: {snoozed_ts: snoozedTs}},
            },
          };
        }
      );
    },
    [api, organization, queryClient, features]
  );

  const showPrompt = useCallback(
    (feature: string) => {
      if (!organization) {
        return;
      }
      promptsUpdate(api, {
        organization,
        feature,
        status: 'visible',
      });

      // Update cached query data
      // Will clear the status/timestamps of a prompt that is dismissed or snoozed
      queryClient.setQueryData(
        makePromptsCheckApiOptions({
          organization,
          feature: features,
        }).queryKey,
        previous => {
          const existingData = previous?.json;

          return {
            ...previous,
            headers: previous?.headers ?? {},
            json: {
              data: {},
              features: {...existingData?.features, [feature]: {}},
            },
          };
        }
      );
    },
    [api, organization, queryClient, features]
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
  options?: PromptQueryOptions;
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
    queryClient.setQueryData(
      makePromptsCheckApiOptions({
        organization,
        feature,
        projectId,
      }).queryKey,
      previous => {
        const dismissedTs = Date.now() / 1000;
        return {
          ...previous,
          headers: previous?.headers ?? {},
          json: {
            data: {dismissed_ts: dismissedTs},
            features: {[feature]: {dismissed_ts: dismissedTs}},
          },
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
    queryClient.setQueryData(
      makePromptsCheckApiOptions({
        organization,
        feature,
        projectId,
      }).queryKey,
      previous => {
        const snoozedTs = Date.now() / 1000;
        return {
          ...previous,
          headers: previous?.headers ?? {},
          json: {
            data: {snoozed_ts: snoozedTs},
            features: {[feature]: {snoozed_ts: snoozedTs}},
          },
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
    queryClient.setQueryData(
      makePromptsCheckApiOptions({
        organization,
        feature,
        projectId,
      }).queryKey,
      previous => {
        return {
          ...previous,
          headers: previous?.headers ?? {},
          json: {
            data: {},
            features: {[feature]: {}},
          },
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
  }
): Promise<Record<T[number], PromptData>> {
  const query = {
    feature: features,
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

type PromptQueryOptions = {enabled?: boolean};
