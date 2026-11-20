// This file contains the analytic events for the performance landing page.
// The analytic events for the insights modules are stored separately in
// analytics/insightAnalyticsEvents.tsx
import type {Organization} from 'sentry/types/organization';
import type {LandingDisplayField} from 'sentry/views/performance/landing/utils';

type PerformanceTourParams = {duration: number; step: number};

type PageLayoutParams = {project_platforms: string};

export type PerformanceEventParameters = {
  'performance_views.events.events_tab_clicked': PageLayoutParams;
  'performance_views.landing.table.seen': Record<string, unknown>;
  'performance_views.landing.table.unparameterized': {
    first_event: 'none' | '14d' | '30d' | '>30d';
    hit_multi_project_cap: boolean;
    sent_transaction: boolean;
    single_project: boolean;
    stats_period: string;
  };
  'performance_views.landingv2.transactions.sort': {direction?: string; field?: string};
  'performance_views.landingv3.table_pagination': {direction: string};
  'performance_views.landingv3.widget.interaction': {widget_type?: string};
  'performance_views.landingv3.widget.switch': {
    from_default?: boolean;
    from_widget?: string;
    to_widget?: string;
  };
  'performance_views.overview.cellaction': {action?: string};
  'performance_views.overview.has_data': {
    table_data_state: 'has_data' | 'no_data' | 'onboarding';
    tab?: LandingDisplayField;
  };
  'performance_views.overview.navigate.summary': {project_platforms: string};
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
  'performance_views.project_transaction_threshold.clear': Record<string, unknown>;
  'performance_views.relative_breakdown.selection': {action: string};
  'performance_views.sample_spans.span_clicked': {
    organization: Organization;
    source: string;
  };
  'performance_views.spans.spans_tab_clicked': PageLayoutParams;
  'performance_views.summary.create_alert_clicked': Record<string, unknown>;
  'performance_views.summary.open_issues': Record<string, unknown>;
  'performance_views.team_key_transaction.set': {action: string};
  'performance_views.tour.advance': PerformanceTourParams;
  'performance_views.tour.close': PerformanceTourParams;
  'performance_views.tour.start': Record<string, unknown>;
  'performance_views.trace_view_v1_page_load': {
    organization: Organization;
    source: string;
  };
  'performance_views.transactionEvents.cellaction': {action: string};
  'performance_views.transactionEvents.display_filter_dropdown.selection': {
    action: string;
  };
  'performance_views.transactionEvents.ops_filter_dropdown.selection': {action: string};
  'performance_views.transactionEvents.sort': {direction?: string; field?: string};
  'performance_views.transaction_summary.status_breakdown_click': {status: string};
  'performance_views.transaction_summary.view': Record<string, unknown>;
};

type PerformanceEventKey = keyof PerformanceEventParameters;

export const performanceEventMap: Record<PerformanceEventKey, string | null> = {
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
  'performance_views.trace_view_v1_page_load':
    'Performance Views: Trace View v1 Page Load',
  'performance_views.landingv3.table_pagination':
    'Performance Views: Landing Page Transactions Table Page Changed',
  'performance_views.overview.has_data':
    'Performance Views: Transaction overview with data present',
  'performance_views.sample_spans.span_clicked': 'Performance Views: Sample span clicked',
  'performance_views.summary.create_alert_clicked':
    'Performance Views: Create alert clicked',
  'performance_views.project_transaction_threshold.change':
    'Project Transaction Threshold: Changed',
  'performance_views.project_issue_detection_threshold_changed':
    'Performance Views: Changed detector threshold of an issue for a project',
  'performance_views.project_issue_detection_thresholds_reset':
    'Performance Views: Reset the detector thresholds of an issue for a project',
  'performance_views.project_transaction_threshold.clear':
    'Project Transaction Threshold: Cleared',
  'performance_views.transaction_summary.status_breakdown_click':
    'Performance Views: Transaction Summary status breakdown option clicked',
  'performance_views.team_key_transaction.set':
    'Performance Views: Set Team Key Transaction',
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
  'performance_views.relative_breakdown.selection':
    'Performance Views: Select Relative Breakdown',
  'performance_views.events.events_tab_clicked': 'Performance Views: Events tab clicked',
  'performance_views.spans.spans_tab_clicked': 'Performance Views: Spans tab clicked',
  'performance_views.summary.open_issues':
    'Performance Views: Open issues from transaction summary',
  'performance_views.landing.table.unparameterized':
    'Performance Views: Landing Page - Table Unparameterized',
  'performance_views.landing.table.seen': 'Performance Views: Landing Page - Table Seen',
};
