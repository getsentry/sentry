import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';

export type MetricsAnalyticsEventParameters = {
  'metrics.explorer.metadata': {
    datetime_selection: string;
    environment_count: number;
    has_exceeded_performance_usage_limit: boolean | null;
    interval: string;
    metric_panels_with_filters_count: number;
    metric_panels_with_group_bys_count: number;
    metric_queries_count: number;
    project_count: number;
    title: string;
  };
  'metrics.explorer.panel.metadata': {
    aggregate_function: string;
    confidences: string[];
    dataScanned: string;
    dataset: string;
    empty_buckets_percentage: number[];
    group_bys: readonly string[];
    interval: string;
    metric_name: string;
    metric_type: string;
    query_status: 'success' | 'error' | 'pending';
    sample_counts: number[];
    table_result_length: number;
    table_result_mode: 'metric samples' | 'aggregates';
    table_result_sort: string[];
    user_queries: string;
    user_queries_count: number;
    panel_index?: number;
  };
  'metrics.explorer.setup_button_clicked': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'metrics.issue_details.drawer_opened': {
    organization: Organization;
  };
  'metrics.nav.rendered': {
    has_feature_flag: boolean;
    has_metrics_supported_platform: boolean;
    metrics_supported_platform_name: string | undefined;
    metrics_tab_visible: boolean;
    organization: Organization;
  };
  'metrics.onboarding': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
    supports_onboarding_checklist: boolean;
  };
  'metrics.onboarding_platform_docs_viewed': {
    organization: Organization;
    platform: PlatformKey | 'unknown';
  };
  'metrics.save_as': {
    organization: Organization;
    save_type: 'alert' | 'dashboard' | 'update_query';
    ui_source: string;
  };
  'metrics.save_query_modal': {
    action: 'open';
    organization: Organization;
    save_type: 'save_new_query';
    ui_source: string;
  };
};

type MetricsAnalyticsEventKey = keyof MetricsAnalyticsEventParameters;

export const metricsAnalyticsEventMap: Record<MetricsAnalyticsEventKey, string | null> = {
  'metrics.explorer.metadata': 'Metric Explorer Pageload Metadata',
  'metrics.explorer.panel.metadata': 'Metric Explorer Panel Metadata',
  'metrics.issue_details.drawer_opened': 'Metrics Issue Details Drawer Opened',
  'metrics.explorer.setup_button_clicked': 'Metrics Setup Button Clicked',
  'metrics.nav.rendered': 'Metrics Nav Rendered',
  'metrics.onboarding': 'Metrics Explore Empty State (Onboarding)',
  'metrics.onboarding_platform_docs_viewed':
    'Metrics Explore Empty State (Onboarding) - Platform Docs Viewed',
  'metrics.save_as': 'Metrics Save As',
  'metrics.save_query_modal': 'Metrics Save Query Modal',
};
