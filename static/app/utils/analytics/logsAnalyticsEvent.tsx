import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';

export enum LogsAnalyticsPageSource {
  EXPLORE_LOGS = 'explore',
  ISSUE_DETAILS = 'issue details',
  TRACE_DETAILS = 'trace details',
  REPLAY_DETAILS = 'replay details',
}

export type LogsAnalyticsEventParameters = {
  'logs.ai_query_applied': {
    group_by_count: number;
    organization: Organization;
    query: string;
  };
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
  'logs.explorer.metadata': {
    columns: readonly string[];
    columns_count: number;
    confidences: string[];
    dataScanned: string;
    dataset: string;
    empty_buckets_percentage: number[];
    has_exceeded_performance_usage_limit: boolean | null;
    interval: string;
    page_source: LogsAnalyticsPageSource;
    query_status: 'success' | 'error' | 'pending';
    sample_counts: number[];
    table_result_length: number;
    table_result_missing_root: number;
    table_result_mode: 'log samples' | 'aggregates';
    table_result_sort: string[];
    user_queries: string;
    user_queries_count: number;
  };
  'logs.explorer.setup_button_clicked': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'logs.issue_details.drawer_opened': {
    organization: Organization;
  };
  'logs.onboarding': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'logs.onboarding_platform_docs_viewed': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
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
  'logs.table.row_copied_as_json': {
    log_id: string;
    organization: Organization;
  };
  'logs.table.row_expanded': {
    log_id: string;
    page_source: LogsAnalyticsPageSource;
  };
  'logs.timestamp_tooltip.add_timezone_clicked': {
    organization: Organization;
  };
  'logs.tracing_onboarding': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'logs.tracing_onboarding_performance_docs_viewed': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
  };
  'logs.tracing_onboarding_platform_docs_viewed': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
  };
};

type LogsAnalyticsEventKey = keyof LogsAnalyticsEventParameters;

export const logsAnalyticsEventMap: Record<LogsAnalyticsEventKey, string | null> = {
  'logs.auto_refresh.timeout': 'Log Auto-refresh Timeout',
  'logs.auto_refresh.toggled': 'Log Auto-refresh Toggled',
  'logs.explorer.setup_button_clicked': 'Logs Setup Button Clicked',
  'logs.explorer.metadata': 'Log Explorer Pageload Metadata',
  'logs.onboarding': 'Logs Explore Empty State (Onboarding)',
  'logs.issue_details.drawer_opened': 'Issues Page Logs Drawer Opened',
  'logs.timestamp_tooltip.add_timezone_clicked':
    'Logs Timestamp Tooltip Add Timezone Clicked',
  'logs.table.row_expanded': 'Expanded Log Row Details',
  'logs.tracing_onboarding': 'Logs Tracing Onboarding',
  'logs.tracing_onboarding_performance_docs_viewed':
    'Logs Tracing Onboarding Performance Docs Viewed',
  'logs.tracing_onboarding_platform_docs_viewed':
    'Logs Tracing Onboarding Platform Docs Viewed',
  'logs.save_as': 'Logs Save As',
  'logs.save_query_modal': 'Logs Save Query Modal',
  'logs.onboarding_platform_docs_viewed':
    'Logs Explore Empty State (Onboarding) - Platform Docs Viewed',
  'logs.table.row_copied_as_json': 'Logs Row Copied as JSON',
  'logs.ai_query_applied': 'Logs AI Query Applied',
};
