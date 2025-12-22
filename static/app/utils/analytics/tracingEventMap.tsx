import type {PlatformKey} from 'sentry/types/project';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {CrossEventType} from 'sentry/views/explore/queryParams/crossEvent';
import type {TraceTreeSource} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {TraceDrawerActionKind} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

export type TracingEventParameters = {
  'compare_queries.add_query': {
    num_queries: number;
  };
  'trace.configurations_docs_link_clicked': {
    title: string;
  };

  'trace.explorer.ai_query_applied': {
    group_by_count: number;
    query: string;
    visualize_count: number;
  };
  'trace.explorer.ai_query_feedback': {
    correct_query_results: 'yes' | 'no';
    natural_language_query: string;
    query: string;
  };
  'trace.explorer.ai_query_interface': {
    action: 'opened' | 'closed' | 'consent_accepted';
  };
  'trace.explorer.ai_query_rejected': {
    natural_language_query: string;
    num_queries_returned: number;
  };
  'trace.explorer.ai_query_submitted': {
    natural_language_query: string;
  };
  'trace.explorer.cross_event_added': {
    type: CrossEventType;
  };
  'trace.explorer.cross_event_changed': {
    new_type: CrossEventType;
    old_type: CrossEventType;
  };
  'trace.explorer.cross_event_removed': {
    type: CrossEventType;
  };
  'trace.explorer.metadata': {
    columns: readonly string[];
    columns_count: number;
    confidences: string[];
    dataScanned: string;
    dataset: string;
    empty_buckets_percentage: number[];
    gave_seer_consent: 'given' | 'not_given' | 'gen_ai_features_disabled';
    has_exceeded_performance_usage_limit: boolean | null;
    interval: string;
    page_source: 'explore' | 'compare';
    query_status: 'success' | 'error' | 'pending';
    result_length: number;
    result_missing_root: number;
    result_mode: 'trace samples' | 'span samples' | 'aggregates' | 'attribute breakdowns';
    sample_counts: number[];
    title: string;
    user_queries: string;
    user_queries_count: number;
    version: 2;
    visualizes: BaseVisualize[];
    visualizes_count: number;
    attribute_breakdowns_mode?: 'breakdowns' | 'cohort_comparison';
    cross_event_log_query_count?: number;
    cross_event_metric_query_count?: number;
    cross_event_span_query_count?: number;
  };
  'trace.explorer.schema_hints_click': {
    source: 'list' | 'drawer';
    hint_key?: string;
  };
  'trace.explorer.schema_hints_drawer': {
    drawer_open: boolean;
  };
  'trace.explorer.table_pagination': {
    direction: string;
    num_results: number;
    type: 'samples' | 'traces' | 'aggregates';
  };
  'trace.load.empty_state': {
    source: TraceTreeSource;
  };
  'trace.load.error_state': {
    error_status: number | null;
    source: TraceTreeSource;
    span_count: number | null;
  };
  'trace.metadata': {
    eap_spans_count: number;
    has_exceeded_performance_usage_limit: boolean | null;
    issues_count: number;
    num_nodes: number;
    num_root_children: number;
    project_platforms: string[];
    referrer: string | null;
    shape: string;
    source: TraceTreeSource;
    trace_age: string;
    trace_duration_seconds: number;
  };
  'trace.preferences.autogrouping_change': {
    enabled: boolean;
  };
  'trace.preferences.missing_instrumentation_change': {
    enabled: boolean;
  };
  'trace.quality.missing_spans.doc_link_clicked': Record<string, unknown>;
  'trace.quality.performance_setup.banner_loaded': Record<string, unknown>;
  'trace.quality.performance_setup.checklist_triggered': Record<string, unknown>;
  'trace.quality.performance_setup.learn_more_clicked': Record<string, unknown>;
  'trace.quality.quota_exceeded.banner_loaded': {
    traceType: string;
  };
  'trace.quality.quota_exceeded.increase_budget_clicked': {
    traceType: string;
  };
  'trace.quality.quota_exceeded.learn_more_clicked': {
    traceType: string;
  };
  'trace.trace_drawer_details.eap_span_has_details': {
    has_logs_details: boolean;
    has_profile_details: boolean;
  };
  'trace.trace_drawer_explore_search': {
    key: string;
    kind: TraceDrawerActionKind;
    source: 'drawer' | 'toolbar_menu';
    value: string | number;
  };
  'trace.trace_layout.change': {
    layout: string;
  };
  'trace.trace_layout.drawer_minimize': Record<string, unknown>;
  'trace.trace_layout.reset_zoom': Record<string, unknown>;
  'trace.trace_layout.search_clear': Record<string, unknown>;
  'trace.trace_layout.search_focus': Record<string, unknown>;
  'trace.trace_layout.search_match_navigate': {
    direction: string;
    interaction: string;
  };
  'trace.trace_layout.show_in_view': Record<string, unknown>;
  'trace.trace_layout.span_row_click': {
    num_children: number;
    project_platform: string;
    type: string;
  };
  'trace.trace_layout.tab_pin': Record<string, unknown>;
  'trace.trace_layout.tab_view': {
    tab: string;
  };
  'trace.trace_layout.view_event_json': Record<string, unknown>;
  'trace.trace_layout.view_in_insight_module': {
    module: string;
  };
  'trace.trace_layout.view_shortcuts': Record<string, unknown>;
  'trace.trace_layout.view_similar_spans': {
    module: string;
    source: string;
  };
  'trace.trace_layout.view_span_summary': {
    module: string;
  };
  'trace.trace_layout.zoom_to_fill': Record<string, unknown>;
  'trace.trace_warning_type': {
    type: string;
  };
  'trace.tracing_onboarding': {
    platform: PlatformKey;
    supports_onboarding_checklist: boolean;
    supports_performance: boolean;
  };
  'trace.tracing_onboarding_performance_docs_viewed': {
    platform: string;
  };
  'trace.tracing_onboarding_platform_docs_viewed': {
    platform: string;
  };
  'trace_explorer.add_span_condition': Record<string, unknown>;
  'trace_explorer.compare_queries': Record<string, unknown>;
  'trace_explorer.delete_query': Record<string, unknown>;
  'trace_explorer.open_in_issues': Record<string, unknown>;
  'trace_explorer.open_trace': {
    source: 'trace explorer' | 'new explore';
  };
  'trace_explorer.open_trace_span': {
    source: 'trace explorer' | 'new explore';
  };
  'trace_explorer.remove_span_condition': Record<string, unknown>;
  'trace_explorer.save_as': {
    save_type: 'alert' | 'dashboard' | 'update_query';
    ui_source: 'toolbar' | 'chart' | 'compare chart';
  };
  'trace_explorer.save_query_modal': {
    action: 'open' | 'submit';
    save_type: 'save_new_query' | 'rename_query';
    ui_source: 'toolbar' | 'table';
  };
  'trace_explorer.search_failure': {
    error: string;
    queries: string[];
  };
  'trace_explorer.search_request': {
    queries: string[];
  };

  'trace_explorer.search_success': {
    has_data: boolean;
    num_missing_trace_root: number;
    num_traces: number;
    project_platforms: string[];
    queries: string[];
  };
  'trace_explorer.star_query': {
    save_type: 'star_query' | 'unstar_query';
    ui_source: 'table' | 'explorer';
  };
  'trace_explorer.toggle_trace_details': {
    expanded: boolean;
    source: 'trace explorer' | 'new explore';
  };
};

type TracingEventKey = keyof TracingEventParameters;

export const tracingEventMap: Record<TracingEventKey, string | null> = {
  'compare_queries.add_query': 'Compare Queries: Add Query',
  'trace.metadata': 'Trace Load Metadata',
  'trace.load.empty_state': 'Trace Load Empty State',
  'trace.load.error_state': 'Trace Load Error State',
  'trace.explorer.ai_query_applied': 'Trace Explorer: AI Query Applied',
  'trace.explorer.ai_query_rejected': 'Trace Explorer: AI Query Rejected',
  'trace.explorer.ai_query_submitted': 'Trace Explorer: AI Query Submitted',
  'trace.explorer.ai_query_interface': 'Trace Explorer: AI Query Interface',
  'trace.explorer.ai_query_feedback': 'Trace Explorer: AI Query Feedback',
  'trace.explorer.metadata': 'Improved Trace Explorer Pageload Metadata',
  'trace.explorer.cross_event_added': 'Trace Explorer: Cross Event Added',
  'trace.explorer.cross_event_changed': 'Trace Explorer: Cross Event Changed',
  'trace.explorer.cross_event_removed': 'Trace Explorer: Cross Event Removed',
  'trace.explorer.schema_hints_click':
    'Improved Trace Explorer: Schema Hints Click Events',
  'trace.explorer.schema_hints_drawer':
    'Improved Trace Explorer: Schema Hints Drawer Events',
  'trace.explorer.table_pagination': 'Trace Explorer Table Pagination',
  'trace.trace_layout.change': 'Changed Trace Layout',
  'trace.trace_layout.drawer_minimize': 'Minimized Trace Drawer',
  'trace.trace_drawer_explore_search': 'Searched Trace Explorer',
  'trace.trace_drawer_details.eap_span_has_details': 'EAP Span has Details',
  'trace.tracing_onboarding': 'Tracing Onboarding UI',
  'trace.tracing_onboarding_platform_docs_viewed':
    'Viewed Platform Docs for Onboarding UI',
  'trace.tracing_onboarding_performance_docs_viewed':
    'Viewed Performance Setup Docs from Onboarding UI',
  'trace.trace_layout.show_in_view': 'Clicked Show in View Action',
  'trace.trace_layout.view_event_json': 'Clicked View Event JSON Action',
  'trace.trace_layout.tab_pin': 'Pinned Trace Tab',
  'trace.trace_layout.tab_view': 'Viewed Trace Tab',
  'trace.trace_layout.search_focus': 'Focused Trace Search',
  'trace.trace_layout.reset_zoom': 'Reset Trace Zoom',
  'trace.quality.performance_setup.checklist_triggered':
    'Triggered Performance Setup Checklist',
  'trace.quality.missing_spans.doc_link_clicked':
    'Clicked custom instrumentation documentation link in missing spans info banner',
  'trace.quality.performance_setup.learn_more_clicked':
    'Clicked Learn More in Performance Setup Banner',
  'trace.quality.performance_setup.banner_loaded': 'Performance Setup Banner Loaded',
  'trace.quality.quota_exceeded.increase_budget_clicked':
    'Clicked Increase Budget in Quota Exceeded Banner',
  'trace.quality.quota_exceeded.learn_more_clicked':
    'Clicked Learn More in Quota Exceeded Banner',
  'trace.configurations_docs_link_clicked': 'Clicked Traces Configurations Docs Link',
  'trace.quality.quota_exceeded.banner_loaded':
    'Performance Quota Exceeded Banner Loaded',
  'trace.trace_layout.view_shortcuts': 'Viewed Trace Shortcuts',
  'trace.trace_warning_type': 'Viewed Trace Warning Type',
  'trace.trace_layout.zoom_to_fill': 'Trace Zoom to Fill',
  'trace.trace_layout.search_clear': 'Clear Trace Search',
  'trace.trace_layout.view_in_insight_module': 'View Trace Span in Insight Module',
  'trace.trace_layout.search_match_navigate': 'Navigate Trace Search Matches',
  'trace.trace_layout.view_similar_spans': 'View Similar Spans in Trace',
  'trace.trace_layout.view_span_summary': 'More Samples in Trace',
  'trace.trace_layout.span_row_click': 'Clicked Span Row in Trace',
  'trace_explorer.add_span_condition': 'Trace Explorer: Add Another Span',
  'trace_explorer.open_in_issues': 'Trace Explorer: Open Trace in Issues',
  'trace_explorer.open_trace': 'Trace Explorer: Open Trace in Trace Viewer',
  'trace_explorer.open_trace_span': 'Trace Explorer: Open Trace Span in Trace Viewer',
  'trace_explorer.remove_span_condition': 'Trace Explorer: Remove Span',
  'trace_explorer.toggle_trace_details': 'Trace Explorer: Toggle Trace Details in Table',
  'trace_explorer.search_failure': 'Trace Explorer: Search Failure',
  'trace_explorer.search_request': 'Trace Explorer: Search Request',
  'trace_explorer.search_success': 'Trace Explorer: Search Success',
  'trace.preferences.autogrouping_change': 'Changed Autogrouping Preference',
  'trace.preferences.missing_instrumentation_change':
    'Changed Missing Instrumentation Preference',
  'trace_explorer.save_as': 'Trace Explorer: Save As',
  'trace_explorer.compare_queries': 'Trace Explorer: Compare',
  'trace_explorer.save_query_modal': 'Trace Explorer: Save Query Modal',
  'trace_explorer.star_query': 'Trace Explorer: Star Query',
  'trace_explorer.delete_query': 'Trace Explorer: Delete Query',
};
