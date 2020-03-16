import {Client} from 'app/api';

type PromptsUpdateParams = {
  organizationId: string;
  projectId: string;
  feature: string;
  status: string;
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
