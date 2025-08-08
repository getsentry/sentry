import type {Organization} from 'sentry/types/organization';

export enum LogsAnalyticsPageSource {
  EXPLORE_LOGS = 'explore',
  ISSUE_DETAILS = 'issue details',
  TRACE_DETAILS = 'trace details',
}

export type LogsAnalyticsEventParameters = {
  'logs.auto_refresh.timeout': {
    organization: Organization;
    page_source: LogsAnalyticsPageSource;
  };
  'logs.auto_refresh.toggled': {
    fromPaused: boolean;
    organization: Organization;
    page_source: LogsAnalyticsPageSource;
    toggleState: 'enabled' | 'disabled';
  };
  'logs.doc_link.clicked': {
    organization: Organization;
  };
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
  'logs.issue_details.drawer_opened': {
    organization: Organization;
  };
  'logs.save_as': {
    save_type: 'alert' | 'dashboard' | 'update_query';
    ui_source: 'toolbar' | 'chart' | 'compare chart' | 'searchbar';
  };
  'logs.save_query_modal': {
    action: 'open' | 'submit';
    save_type: 'save_new_query' | 'rename_query';
    ui_source: 'toolbar' | 'table';
  };
  'logs.table.row_expanded': {
    log_id: string;
    page_source: LogsAnalyticsPageSource;
  };
};

type LogsAnalyticsEventKey = keyof LogsAnalyticsEventParameters;

export const logsAnalyticsEventMap: Record<LogsAnalyticsEventKey, string | null> = {
  'logs.auto_refresh.timeout': 'Log Auto-refresh Timeout',
  'logs.auto_refresh.toggled': 'Log Auto-refresh Toggled',
  'logs.doc_link.clicked': 'Logs documentation link clicked',
  'logs.explorer.metadata': 'Log Explorer Pageload Metadata',
  'logs.issue_details.drawer_opened': 'Issues Page Logs Drawer Opened',
  'logs.table.row_expanded': 'Expanded Log Row Details',
  'logs.save_as': 'Logs Save As',
  'logs.save_query_modal': 'Logs Save Query Modal',
};
