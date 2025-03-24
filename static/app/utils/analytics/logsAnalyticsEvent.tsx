export enum LogsAnalyticsPageSource {
  EXPLORE_LOGS = 'explore',
  ISSUE_DETAILS = 'issue details',
  TRACE_DETAILS = 'trace details',
}

export type LogsAnalyticsEventParameters = {
  'logs.explorer.metadata': {
    columns: string[];
    columns_count: number;
    dataset: string;
    has_exceeded_performance_usage_limit: boolean | null;
    page_source: LogsAnalyticsPageSource;
    query_status: 'success' | 'error' | 'pending';
    table_result_length: number;
    table_result_missing_root: number;
    user_queries: string;
    user_queries_count: number;
  };
  'logs.table.row_expanded': {
    log_id: string;
    page_source: LogsAnalyticsPageSource;
  };
};

export type LogsAnalyticsEventKey = keyof LogsAnalyticsEventParameters;

export const logsAnalyticsEventMap: Record<LogsAnalyticsEventKey, string | null> = {
  'logs.explorer.metadata': 'Log Explorer Pageload Metadata',
  'logs.table.row_expanded': 'Expanded Log Row Details',
};
