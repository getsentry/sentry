import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

export function SeerWorkflowConfigFixture(
  params: Partial<SeerWorkflowConfigResponse> = {}
): SeerWorkflowConfigResponse {
  return {
    id: '1',
    strategy: 'agentic_triage',
    enabled: true,
    cronSchedules: [{crontab: '0 10,22 * * *', timezone: 'UTC'}],
    version: 1,
    projects: [],
    monitorIds: [],
    environments: [],
    filters: {},
    outputPolicy: {},
    seededDefault: null,
    serviceAccount: null,
    dateAdded: '2026-10-01T00:00:00Z',
    dateUpdated: '2026-10-01T00:00:00Z',
    ...params,
  };
}
