import type {PlatformKey} from 'sentry/types/project';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {TraceWaterFallSource} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {TraceDrawerActionKind} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

export type TracingEventParameters = {
  'trace.configurations_docs_link_clicked': {
    title: string;
  };
  'trace.explorer.metadata': {
    columns: string[];
    columns_count: number;
    confidences: string[];
    dataset: string;
    has_exceeded_performance_usage_limit: boolean | null;
    query_status: 'success' | 'error' | 'pending';
    result_length: number;
    result_missing_root: number;
    result_mode: 'trace samples' | 'span samples' | 'aggregates';
    title: string;
    user_queries: string;
    user_queries_count: number;
    visualizes: BaseVisualize[];
    visualizes_count: number;
  };
  'trace.load.empty_state': {
    source: TraceWaterFallSource;
  };
  'trace.load.error_state': {
    source: TraceWaterFallSource;
  };
  'trace.metadata': {
    has_exceeded_performance_usage_limit: boolean | null;
    num_nodes: number;
    num_root_children: number;
    project_platforms: string[];
    referrer: string | null;
    shape: string;
    source: TraceWaterFallSource;
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
    next_op?: string;
    parent_op?: string;
    previous_op?: string;
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
  'trace_explorer.open_in_issues': Record<string, unknown>;
  'trace_explorer.open_trace': {
    source: 'trace explorer' | 'new explore';
  };
  'trace_explorer.open_trace_span': {
    source: 'trace explorer' | 'new explore';
  };
  'trace_explorer.remove_span_condition': Record<string, unknown>;
  'trace_explorer.save_as': {
    save_type: 'alert' | 'dashboard';
    ui_source: 'toolbar' | 'chart';
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
  'trace_explorer.toggle_trace_details': {
    expanded: boolean;
    source: 'trace explorer' | 'new explore';
  };
};

export type TracingEventKey = keyof TracingEventParameters;

export const tracingEventMap: Record<TracingEventKey, string | null> = {
  'trace.metadata': 'Trace Load Metadata',
  'trace.load.empty_state': 'Trace Load Empty State',
  'trace.load.error_state': 'Trace Load Error State',
  'trace.explorer.metadata': 'Improved Trace Explorer Pageload Metadata',
  'trace.trace_layout.change': 'Changed Trace Layout',
  'trace.trace_layout.drawer_minimize': 'Minimized Trace Drawer',
  'trace.trace_drawer_explore_search': 'Searched Trace Explorer',
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
};
