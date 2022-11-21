import {PlatformKey} from 'sentry/data/platformCategories';

type SampleTransactionParam = {
  platform?: PlatformKey;
};

type PerformanceTourParams = {
  duration: number;
  step: number;
};

export type PerformanceEventParameters = {
  'performance_views.all_events.open_in_discover': {};
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
    project_platform: string;
  };
  'performance_views.event_details.search_query': {};
  'performance_views.filter_dropdown.selection': {
    action: string;
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
  'performance_views.overview.navigate.summary': {
    project_platforms: string;
  };
  'performance_views.overview.search': {};
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
  'performance_views.summary.tag_explorer.cell_action': {};
  'performance_views.summary.tag_explorer.change_page': {};
  'performance_views.summary.tag_explorer.sort': {
    direction?: string;
    field?: string;
  };
  'performance_views.summary.tag_explorer.tag_value': {};
  'performance_views.summary.tag_explorer.visit_tag_key': {};
  'performance_views.tags.change_aggregate_column': {
    value: string;
  };
  'performance_views.tags.change_tag': {
    from_tag: string;
    is_other_tag: boolean;
    to_tag: string;
  };
  'performance_views.tags.jump_to_release': {};
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
};

export type PerformanceEventKey = keyof PerformanceEventParameters;

export const performanceEventMap: Record<PerformanceEventKey, string | null> = {
  'performance_views.create_sample_transaction': 'Growth: Performance Sample Transaction',
  'performance_views.tour.start': 'Performance Views: Tour Start',
  'performance_views.tour.advance': 'Performance Views: Tour Advance',
  'performance_views.tour.close': 'Performance Views: Tour Close',
  'performance_views.landingv2.transactions.sort':
    'Performance Views: Landing Transactions Sorted',
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
  'performance_views.span_summary.change_chart':
    'Performance Views: Span Summary displayed chart changed',
  'performance_views.spans.change_op': 'Performance Views: Change span operation name',
  'performance_views.spans.change_sort': 'Performance Views: Change span sort column',
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
  'performance_views.transaction_summary.view':
    'Performance Views: Transaction Summary View',
  'performance_views.filter_dropdown.selection': 'Performance Views: Filter Dropdown',
  'performance_views.relative_breakdown.selection':
    'Performance Views: Select Relative Breakdown',
  'performance_views.mep.metrics_outcome': 'Performance Views: Metrics Outcome',
};
