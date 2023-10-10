import type {PlatformKey} from 'sentry/types';
import {Organization} from 'sentry/types';

type SampleTransactionParam = {
  platform?: PlatformKey;
};

type PerformanceTourParams = {
  duration: number;
  step: number;
};

type PageLayoutParams = {
  project_platforms: string;
};

export type PerformanceEventParameters = {
  'performance_views.all_events.open_in_discover': {};
  'performance_views.anomalies.anomalies_tab_clicked': PageLayoutParams;
  'performance_views.change_view': {
    project_platforms: string;
    view_name: string;
  };
  'performance_views.create_sample_transaction': SampleTransactionParam;
  'performance_views.event_details.anchor_span': {
    span_id: string;
  };
  'performance_views.event_details.filter_by_op': {
    operation: string;
  };
  'performance_views.event_details.json_button_click': {};
  'performance_views.event_details.open_span_details': {
    operation: string;
    origin: string;
    project_platform: string;
  };
  'performance_views.event_details.search_query': {};
  'performance_views.events.events_tab_clicked': PageLayoutParams;
  'performance_views.filter_dropdown.selection': {
    action: string;
  };
  'performance_views.landing.table.seen': {};
  'performance_views.landing.table.unparameterized': {
    first_event: 'none' | '14d' | '30d' | '>30d';
    hit_multi_project_cap: boolean;
    sent_transaction: boolean;
    single_project: boolean;
    stats_period: string;
  };
  'performance_views.landingv2.display.filter_change': {
    field: string;
    max_value: number;
    min_value: number;
  };
  'performance_views.landingv2.transactions.sort': {
    direction?: string;
    field?: string;
  };
  'performance_views.landingv3.batch_queries': {
    num_collected: number;
    num_saved: number;
    num_sent: number;
  };
  'performance_views.landingv3.display_change': {
    change_to_display: string;
    current_display: string;
    default_display: string;
    is_default: boolean;
  };
  'performance_views.landingv3.table_pagination': {
    direction: string;
  };
  'performance_views.landingv3.widget.interaction': {
    widget_type?: string;
  };
  'performance_views.landingv3.widget.switch': {
    is_new_menu: boolean;
    from_default?: boolean;
    from_widget?: string;
    to_widget?: string;
  };
  'performance_views.mep.metrics_outcome': {
    fallback_from_null: boolean;
    fallback_from_unparam: boolean;
    is_on_metrics: boolean;
  };
  'performance_views.overview.cellaction': {action?: string};
  'performance_views.overview.change_chart': {
    metric: string;
  };
  'performance_views.overview.navigate.summary': {
    project_platforms: string;
  };
  'performance_views.overview.search': {};
  'performance_views.performance_change_explorer.function_link_clicked': {
    function: string;
    package: string;
    profile_id: string;
    transaction: string;
  };
  'performance_views.performance_change_explorer.open': {
    transaction: string;
  };
  'performance_views.performance_change_explorer.span_link_clicked': {
    group: string;
    op: string;
    transaction: string;
  };
  'performance_views.performance_change_explorer.summary_link_clicked': {
    transaction: string;
  };
  'performance_views.project_issue_detection_threshold_changed': {
    organization: Organization;
    project_slug: string;
    threshold_key: string;
    threshold_value: number;
  };
  'performance_views.project_issue_detection_thresholds_reset': {
    organization: Organization;
    project_slug: string;
  };
  'performance_views.project_transaction_threshold.change': {
    from: string;
    key: string;
    to: string;
  };
  'performance_views.project_transaction_threshold.clear': {};
  'performance_views.relative_breakdown.selection': {
    action: string;
  };
  'performance_views.span_summary.change_chart': {
    change_to_display: string;
  };
  'performance_views.spans.change_op': {
    operation_name?: string;
  };
  'performance_views.spans.change_sort': {
    sort_column?: string;
  };
  'performance_views.spans.spans_tab_clicked': PageLayoutParams;
  'performance_views.summary.create_alert_clicked': {};
  'performance_views.summary.open_issues': {};
  'performance_views.summary.tag_explorer.cell_action': {};
  'performance_views.summary.tag_explorer.change_page': {};
  'performance_views.summary.tag_explorer.sort': {
    direction?: string;
    field?: string;
  };
  'performance_views.summary.tag_explorer.tag_value': {};
  'performance_views.summary.tag_explorer.visit_tag_key': {};
  'performance_views.summary.view_in_transaction_events': {};
  'performance_views.tags.change_aggregate_column': {
    value: string;
  };
  'performance_views.tags.change_tag': {
    from_tag: string;
    is_other_tag: boolean;
    to_tag: string;
  };
  'performance_views.tags.interaction': {};
  'performance_views.tags.jump_to_release': {};
  'performance_views.tags.tags_tab_clicked': PageLayoutParams;
  'performance_views.team_key_transaction.set': {
    action: string;
  };
  'performance_views.tour.advance': PerformanceTourParams;
  'performance_views.tour.close': PerformanceTourParams;
  'performance_views.tour.start': {};
  'performance_views.trace_view.open_in_discover': {};
  'performance_views.trace_view.open_transaction_details': {
    operation: string;
    transaction: string;
  };
  'performance_views.trace_view.view': {};
  'performance_views.transactionEvents.cellaction': {
    action: string;
  };
  'performance_views.transactionEvents.display_filter_dropdown.selection': {
    action: string;
  };
  'performance_views.transactionEvents.ops_filter_dropdown.selection': {
    action: string;
  };
  'performance_views.transactionEvents.sort': {
    direction?: string;
    field?: string;
  };
  'performance_views.transaction_summary.change_chart_display': {
    from_chart: string;
    to_chart: string;
  };
  'performance_views.transaction_summary.status_breakdown_click': {
    status: string;
  };
  'performance_views.transaction_summary.view': {};
  'performance_views.trends.change_duration': {
    value: string;
    widget_type: string;
  };
  'performance_views.trends.change_function': {
    function_name: string;
  };
  'performance_views.trends.change_parameter': {
    parameter_name: string;
  };
  'performance_views.trends.widget_interaction': {
    widget_type: string;
  };
  'performance_views.trends.widget_pagination': {
    direction: string;
    widget_type: string;
  };
  'performance_views.vital_detail.switch_vital': {
    from_vital: string;
    to_vital: string;
  };
  'performance_views.vital_detail.view': {
    project_platforms: string;
  };
  'performance_views.vitals.filter_changed': {value: string};
  'performance_views.vitals.open_all_events': {vital: string};
  'performance_views.vitals.open_in_discover': {vital: string};
  'performance_views.vitals.reset_view': {};
  'performance_views.vitals.vitals_tab_clicked': PageLayoutParams;
};

export type PerformanceEventKey = keyof PerformanceEventParameters;

export const performanceEventMap: Record<PerformanceEventKey, string | null> = {
  'performance_views.create_sample_transaction': 'Growth: Performance Sample Transaction',
  'performance_views.tour.start': 'Performance Views: Tour Start',
  'performance_views.tour.advance': 'Performance Views: Tour Advance',
  'performance_views.tour.close': 'Performance Views: Tour Close',
  'performance_views.change_view': 'Performance Views: Change View',
  'performance_views.landingv2.transactions.sort':
    'Performance Views: Landing Transactions Sorted',
  'performance_views.landingv2.display.filter_change':
    'Performance Views: Landing v2 Display Filter Change',
  'performance_views.overview.navigate.summary':
    'Performance Views: Overview view summary',
  'performance_views.overview.cellaction': 'Performance Views: Cell Action Clicked',
  'performance_views.landingv3.widget.interaction':
    'Performance Views: Landing Widget Interaction',
  'performance_views.landingv3.widget.switch':
    'Performance Views: Landing Widget Switched',
  'performance_views.landingv3.batch_queries':
    'Performance Views: Landing Query Batching',
  'performance_views.landingv3.display_change': 'Performance Views: Switch Landing Tabs',
  'performance_views.landingv3.table_pagination':
    'Performance Views: Landing Page Transactions Table Page Changed',
  'performance_views.overview.change_chart': 'Performance Views: Change Overview Chart',
  'performance_views.span_summary.change_chart':
    'Performance Views: Span Summary displayed chart changed',
  'performance_views.spans.change_op': 'Performance Views: Change span operation name',
  'performance_views.spans.change_sort': 'Performance Views: Change span sort column',
  'performance_views.summary.create_alert_clicked':
    'Performance Views: Create alert clicked',
  'performance_views.summary.tag_explorer.tag_value':
    'Performance Views: Tag Explorer Value Clicked',
  'performance_views.summary.tag_explorer.cell_action':
    'Performance Views: Tag Explorer Cell Action Clicked',
  'performance_views.summary.tag_explorer.visit_tag_key':
    'Performance Views: Tag Explorer - Visit Tag Key',
  'performance_views.summary.tag_explorer.change_page':
    'Performance Views: Tag Explorer Change Page',
  'performance_views.summary.tag_explorer.sort': 'Performance Views: Tag Explorer Sorted',
  'performance_views.overview.search': 'Performance Views: Transaction overview search',
  'performance_views.project_transaction_threshold.change':
    'Project Transaction Threshold: Changed',
  'performance_views.project_issue_detection_threshold_changed':
    'Performance Views: Changed detector threshold of an issue for a project',
  'performance_views.project_issue_detection_thresholds_reset':
    'Performance Views: Reset the detector thresholds of an issue for a project',
  'performance_views.project_transaction_threshold.clear':
    'Project Transaction Threshold: Cleared',
  'performance_views.vital_detail.view': 'Performance Views: Vital Detail viewed',
  'performance_views.vital_detail.switch_vital':
    'Performance Views: Vital Detail vital type switched',
  'performance_views.trace_view.view': 'Performance Views: Trace View viewed',
  'performance_views.trace_view.open_in_discover':
    'Performance Views: Trace View open in Discover button clicked',
  'performance_views.trace_view.open_transaction_details':
    'Performance Views: Trace View transaction details opened',
  'performance_views.transaction_summary.change_chart_display':
    'Performance Views: Transaction Summary chart display changed',
  'performance_views.transaction_summary.status_breakdown_click':
    'Performance Views: Transaction Summary status breakdown option clicked',
  'performance_views.all_events.open_in_discover':
    'Performance Views: All Events page open in Discover button clicked',
  'performance_views.tags.change_aggregate_column':
    'Performance Views: Tags page changed aggregate column',
  'performance_views.tags.change_tag':
    'Performance Views: Tags Page changed selected tag',
  'performance_views.tags.jump_to_release':
    'Performance Views: Tags Page link to release in table clicked',
  'performance_views.team_key_transaction.set':
    'Performance Views: Set Team Key Transaction',
  'performance_views.trends.widget_interaction':
    'Performance Views: Trends Widget Interaction',
  'performance_views.trends.widget_pagination':
    'Performance Views: Trends Widget Page Changed',
  'performance_views.trends.change_duration':
    'Performance Views: Trends Widget Duration Changed',
  'performance_views.event_details.filter_by_op':
    'Performance Views: Event Details page operation filter applied',
  'performance_views.event_details.search_query':
    'Performance Views: Event Details search query',
  'performance_views.event_details.open_span_details':
    'Performance Views: Event Details span details opened',
  'performance_views.event_details.anchor_span':
    'Performance Views: Event Details span anchored',
  'performance_views.event_details.json_button_click':
    'Performance Views: Event Details JSON button clicked',
  'performance_views.transactionEvents.cellaction':
    'Performance Views: Transaction Events Tab Cell Action Clicked',
  'performance_views.transactionEvents.sort':
    'Performance Views: Transaction Events Tab Sorted',
  'performance_views.transactionEvents.display_filter_dropdown.selection':
    'Performance Views: Transaction Events Display Filter Dropdown',
  'performance_views.transactionEvents.ops_filter_dropdown.selection':
    'Performance Views: Transaction Events Ops Breakdown Filter Dropdown',
  'performance_views.transaction_summary.view':
    'Performance Views: Transaction Summary View',
  'performance_views.filter_dropdown.selection': 'Performance Views: Filter Dropdown',
  'performance_views.relative_breakdown.selection':
    'Performance Views: Select Relative Breakdown',
  'performance_views.mep.metrics_outcome': 'Performance Views: Metrics Outcome',
  'performance_views.vitals.vitals_tab_clicked': 'Performance Views: Vitals tab clicked',
  'performance_views.tags.tags_tab_clicked': 'Performance Views: Tags tab clicked',
  'performance_views.events.events_tab_clicked': 'Performance Views: Events tab clicked',
  'performance_views.spans.spans_tab_clicked': 'Performance Views: Spans tab clicked',
  'performance_views.anomalies.anomalies_tab_clicked':
    'Performance Views: Anomalies tab clicked',
  'performance_views.summary.view_in_transaction_events':
    'Performance Views: View in All Events from Transaction Summary',
  'performance_views.summary.open_issues':
    'Performance Views: Open issues from transaction summary',
  'performance_views.tags.interaction': 'Performance Views: Tag Page - Interaction',
  'performance_views.vitals.filter_changed': 'Performance Views: Change vitals filter',
  'performance_views.vitals.reset_view': 'Performance Views: Reset vitals view',
  'performance_views.trends.change_parameter': 'Performance Views: Change Parameter',
  'performance_views.trends.change_function': 'Performance Views: Change Function',
  'performance_views.vitals.open_in_discover':
    'Performance Views: Open vitals in discover',
  'performance_views.vitals.open_all_events':
    'Performance Views: Open vitals in all events',
  'performance_views.landing.table.unparameterized':
    'Performance Views: Landing Page - Table Unparameterized',
  'performance_views.landing.table.seen': 'Performance Views: Landing Page - Table Seen',
  'performance_views.performance_change_explorer.function_link_clicked':
    'Performance Views: Performance Change Explorer - Link to Function',
  'performance_views.performance_change_explorer.open':
    'Performance Views: Performance Change Explorer - Opened',
  'performance_views.performance_change_explorer.span_link_clicked':
    'Performance Views: Performance Change Explorer - Link to Span',
  'performance_views.performance_change_explorer.summary_link_clicked':
    'Performance Views: Performance Change Explorer - Link to Summary',
};
