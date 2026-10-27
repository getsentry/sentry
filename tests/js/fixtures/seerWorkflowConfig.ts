import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

export function SeerWorkflowConfigFixture(
  params: Partial<SeerWorkflowConfigResponse> = {}
): SeerWorkflowConfigResponse {
  return {
    id: '1',
    strategy: 'agentic_triage',
    enabled: true,
    schedule: 'daily',
    version: 1,
    projects: [],
    environments: [],
    filters: {},
    outputPolicy: {},
    seededDefault: null,
    dateAdded: '2026-10-01T00:00:00Z',
    dateUpdated: '2026-10-01T00:00:00Z',
    ...params,
  };
}
