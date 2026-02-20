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

interface GroupedLogEntry {
  [key: string]: unknown;
  'count(message)': number;
  message: string;
}

interface LogsResponse {
  data: LogEntry[];
  meta?: {
    fields: Record<string, string>;
  };
}

interface GroupedLogsResponse {
  data: GroupedLogEntry[];
  meta?: {
    fields: Record<string, string>;
  };
}

export interface WorkflowLogsOptions {
  cursor?: string; // Pagination cursor
  end?: string; // Absolute end: ISO 8601 timestamp
  groupByMessage?: boolean;
  messageFilter?: string; // Filter to specific message type (exact match)
  start?: string; // Absolute start: ISO 8601 timestamp
  statsPeriod?: string; // Relative: '24h', '7d', etc. (mutually exclusive with start/end)
}

// Minimal fields for list view - only what's needed for the header row
const LIST_FIELDS = ['id', 'timestamp', 'message', 'severity'];

// All fields for detail view - fetched on-demand when expanding a log entry
export const DETAIL_FIELDS = [
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
  'detection_type',
  'triggered_workflow_ids',
  'delayed_conditions',
  'action_filter_group_ids',
  'triggered_action_ids',
  'debug_msg',
  'context_id',
];

const GROUPED_LOG_FIELDS = ['message', 'count(message)'];

/**
 * Hook to fetch workflow-related logs from the Logging product.
 * Filters logs by the workflow engine evaluation message prefix and workflow ID.
 *
 * @param workflowId - The workflow ID to filter logs for
 * @param organizationId - The organization slug
 * @param options - Optional time filtering and grouping options
 */
export function useWorkflowLogs(
  workflowId: number | undefined,
  organizationId: string | undefined,
  options?: WorkflowLogsOptions
): ReturnType<typeof useApiQuery<LogsResponse | GroupedLogsResponse>> {
  const {
    statsPeriod,
    start,
    end,
    groupByMessage = false,
    cursor,
    messageFilter,
  } = options ?? {};

  // Build query - use exact message match if filtering, otherwise use prefix
  // - StartsWith for message prefix matching (default)
  // - Contains for workflow_ids array matching
  const query = messageFilter
    ? `message:"${messageFilter}" workflow_ids:${WildcardOperators.CONTAINS}${workflowId}`
    : `message:${WildcardOperators.STARTS_WITH}workflow_engine.process_workflows.evaluation workflow_ids:${WildcardOperators.CONTAINS}${workflowId}`;

  // When grouping, change fields to include count aggregation
  // For list view, use minimal fields - details are fetched on-demand
  const fields = groupByMessage ? GROUPED_LOG_FIELDS : LIST_FIELDS;
  const sort = groupByMessage ? '-count_message' : '-timestamp';

  // Build time filter params - use statsPeriod OR start/end, not both
  const timeParams = statsPeriod
    ? {statsPeriod}
    : start && end
      ? {start, end}
      : {statsPeriod: '24h'}; // Default fallback

  return useApiQuery<LogsResponse | GroupedLogsResponse>(
    [
      `/organizations/${organizationId}/events/`,
      {
        query: {
          dataset: DiscoverDatasets.OURLOGS,
          field: fields,
          per_page: 10,
          query,
          sort,
          cursor,
          ...timeParams,
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
