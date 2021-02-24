import {Client} from 'app/api';

type PromptsUpdateParams = {
  /**
   * The numeric organization ID as a string
   */
  organizationId: string;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
  /**
   * The prompt feature name
   */
  feature: string;
  status: 'snoozed' | 'dismissed';
};

/**
 * Update the status of a prompt
 */
export function promptsUpdate(api: Client, params: PromptsUpdateParams) {
  return api.requestPromise('/prompts-activity/', {
    method: 'PUT',
    data: {
      organization_id: params.organizationId,
      project_id: params.projectId,
      feature: params.feature,
      status: params.status,
    },
  });
}

type PromptCheckParams = {
  /**
   * The numeric organization ID as a string
   */
  organizationId: string;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
  /**
   * The prompt feature name
   */
  feature: string;
};

export type PromptResponse = {
  data?: {
    snoozed_ts?: number;
    dismissed_ts?: number;
  };
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
  const query = {
    feature: params.feature,
    organization_id: params.organizationId,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };

  const response: PromptResponse = await api.requestPromise('/prompts-activity/', {
    query,
  });
  const data = response?.data;

  if (!data) {
    return null;
  }

  return {
    dismissedTime: data.dismissed_ts,
    snoozedTime: data.snoozed_ts,
  };
}
