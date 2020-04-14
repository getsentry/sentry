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
  feature: string;
  status: 'snoozed' | 'dismissed';
};

export function promptsUpdate(api: Client, params: PromptsUpdateParams) {
  return api.requestPromise('/promptsactivity/', {
    method: 'PUT',
    data: {
      organization_id: params.organizationId,
      project_id: params.projectId,
      feature: params.feature,
      status: params.status,
    },
  });
}
