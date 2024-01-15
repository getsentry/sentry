import type {Client} from 'sentry/api';
import type {OrganizationSummary} from 'sentry/types';
import {ApiQueryKey, useApiQuery, UseApiQueryOptions} from 'sentry/utils/queryClient';

type PromptsUpdateParams = {
  /**
   * The prompt feature name
   */
  feature: string;
  status: 'snoozed' | 'dismissed';
  // TODO(mark) Remove optional once getsentry is updated.
  organization?: OrganizationSummary;
  // Deprecated.
  organizationId?: string;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
};

/**
 * Update the status of a prompt
 */
export function promptsUpdate(api: Client, params: PromptsUpdateParams) {
  const organizationId = params.organization
    ? params.organization.id
    : params.organizationId;
  const url = params.organization
    ? `/organizations/${params.organization.slug}/prompts-activity/`
    : '/prompts-activity/';
  return api.requestPromise(url, {
    method: 'PUT',
    data: {
      organization_id: organizationId,
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
  feature: string;
  // TODO(mark) Remove optional once getsentry change has landed.
  organization?: OrganizationSummary;
  // Deprecated To be removed once all usage has organization
  organizationId?: string;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
};

export type PromptResponseItem = {
  dismissed_ts?: number;
  snoozed_ts?: number;
};
export type PromptResponse = {
  data?: PromptResponseItem;
  features?: {[key: string]: PromptResponseItem};
};

export type PromptData = null | {
  dismissedTime?: number;
  snoozedTime?: number;
};

/**
 * Get the status of a prompt
 */
export async function promptsCheck(
  api: Client,
  params: PromptCheckParams
): Promise<PromptData> {
  const organizationId = params.organization
    ? params.organization.id
    : params.organizationId;
  const query = {
    feature: params.feature,
    organization_id: organizationId,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };
  const url = params.organization
    ? `/organizations/${params.organization.slug}/prompts-activity/`
    : '/prompts-activity/';

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
  organizationId,
  projectId,
}: PromptCheckParams): ApiQueryKey => {
  const orgId = organization ? organization.id : organizationId;
  const url = organization
    ? `/organizations/${organization.slug}/prompts-activity/`
    : '/prompts-activity/';

  return [url, {query: {feature, organization_id: orgId, project_id: projectId}}];
};

/**
 * @param organizationId org numerical id, not the slug
 */
export function usePromptsCheck(
  {feature, organization, organizationId, projectId}: PromptCheckParams,
  options: Partial<UseApiQueryOptions<PromptResponse>> = {}
) {
  return useApiQuery<PromptResponse>(
    makePromptsCheckQueryKey({feature, organization, organizationId, projectId}),
    {
      staleTime: 120000,
      ...options,
    }
  );
}

/**
 * Get the status of many prompt
 */
export async function batchedPromptsCheck<T extends readonly string[]>(
  api: Client,
  features: T,
  params: {
    organization?: OrganizationSummary;
    organizationId?: string;
    projectId?: string;
  }
): Promise<{[key in T[number]]: PromptData}> {
  const orgId = params.organization ? params.organization.id : params.organizationId;
  const query = {
    feature: features,
    organization_id: orgId,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };
  const url = params.organization
    ? `/organizations/${params.organization.slug}/prompts-activity/`
    : '/prompts-activity/';

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
      result[featureName] = {
        dismissedTime: item.dismissed_ts,
        snoozedTime: item.snoozed_ts,
      };
    } else {
      result[featureName] = null;
    }
  }
  return result as {[key in T[number]]: PromptData};
}
