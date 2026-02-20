import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';

interface LogEntry {
  [key: string]: unknown;
  id: string;
  message: string;
  severity: string;
  timestamp: string;
  trace?: string;
}

interface LogsResponse {
  data: LogEntry[];
  meta?: {
    fields: Record<string, string>;
  };
}

const LOG_FIELDS = [
  'id',
  'timestamp',
  'message',
  'severity',
  'trace',
  'workflow_ids',
  'group_id',
  'event_id',
  'detector_id',
  'organization_id',
  'project_id',
];

/**
 * Hook to fetch workflow-related logs from the Logging product.
 * Filters logs by the workflow engine evaluation message prefix and workflow ID.
 */
export function useWorkflowLogs(
  workflowId: number | undefined,
  organizationId: string | undefined
) {
  // Use WildcardOperators for proper log filtering syntax
  // - StartsWith for message prefix matching
  // - Contains for workflow_ids array matching
  const query = `message:${WildcardOperators.STARTS_WITH}workflow_engine.process_workflows.evaluation workflow_ids:${WildcardOperators.CONTAINS}${workflowId}`;

  return useApiQuery<LogsResponse>(
    [
      `/organizations/${organizationId}/events/`,
      {
        query: {
          dataset: DiscoverDatasets.OURLOGS,
          query,
          field: LOG_FIELDS,
          sort: '-timestamp',
          per_page: 25,
          statsPeriod: '24h',
          referrer: 'admin.alerts-debug.workflow-logs',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!workflowId && !!organizationId,
    }
  );
}
