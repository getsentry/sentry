import type {SourceMapProcessingIssueType} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebug';
import {IntegrationType} from 'sentry/types';
import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';
import {CommonGroupAnalyticsData} from 'sentry/utils/events';

type IssueStream = {
  group_id: string;
  tab: string;
  was_shown_suggestion: boolean;
};

type SourceMapDebugParam = {
  type: SourceMapProcessingIssueType;
  group_id?: string;
} & BaseEventAnalyticsParams;

interface GroupEventParams extends CommonGroupAnalyticsData, BaseEventAnalyticsParams {}

interface ExternalIssueParams extends CommonGroupAnalyticsData {
  external_issue_provider: string;
  external_issue_type: IntegrationType;
}

export type IssueEventParameters = {
  'event_cause.dismissed': {};
  'event_cause.docs_clicked': {};
  'event_cause.snoozed': {};
  'event_cause.viewed': {
    platform?: string;
    project_id?: string;
  };
  'inbox_tab.issue_clicked': {
    group_id: string;
  };
  'issue.search_sidebar_clicked': {};
  'issue.shared_publicly': {};
  'issue_details.copy_event_link_clicked': GroupEventParams;
  'issue_details.event_details_clicked': GroupEventParams;
  'issue_details.external_issue_created': ExternalIssueParams;
  'issue_details.external_issue_modal_opened': ExternalIssueParams;
  'issue_details.header_view_replay_clicked': GroupEventParams;
  'issue_details.performance.autogrouped_siblings_toggle': {};
  'issue_details.performance.hidden_spans_expanded': {};
  'issue_details.view_hierarchy.hover_rendering_system': {
    platform?: string;
    user_org_role?: string;
  };
  'issue_details.view_hierarchy.select_from_tree': {
    platform?: string;
    user_org_role?: string;
  };
  'issue_details.view_hierarchy.select_from_wireframe': {
    platform?: string;
    user_org_role?: string;
  };
  'issue_error_banner.proguard_misconfigured.clicked': {
    group?: string;
    platform?: string;
  };
  'issue_error_banner.proguard_misconfigured.displayed': {
    group?: string;
    platform?: string;
  };
  'issue_error_banner.proguard_missing_mapping.displayed': {
    group?: string;
    platform?: string;
  };
  'issue_error_banner.viewed': {
    error_message: string[];
    error_type: string[];
    group?: string;
    platform?: string;
  };
  'issue_group_details.stack_traces.setup_source_maps_alert.clicked': {
    platform?: string;
    project_id?: string;
  };
  'issue_group_details.tab.clicked': {
    tab: string;
    browser?: string;
    device?: string;
    os?: string;
    platform?: string;
  };
  'issue_group_details.tags.bar.clicked': {
    is_mobile: boolean;
    tag: string;
    value: string;
    platform?: string;
  };
  'issue_group_details.tags.bar.hovered': {
    is_mobile: boolean;
    tag: string;
    value: string;
    platform?: string;
  };
  'issue_group_details.tags.show_all_tags.clicked': {
    is_mobile: boolean;
    platform?: string;
    tag?: string;
  };
  'issue_group_details.tags.switcher.clicked': {
    is_mobile: boolean;
    previous_tag: string;
    tag: string;
    platform?: string;
  };
  'issue_group_details.tags_distribution.bar.clicked': {
    is_mobile: boolean;
    tag: string;
    value: string;
    platform?: string;
  };
  'issue_search.empty': {
    query: string;
    search_source: string;
    search_type: string;
  };
  'issue_search.failed': {
    error: string;
    search_source: string;
    search_type: string;
  };
  'issues_stream.issue_assigned': IssueStream & {
    assigned_type: string;
    did_assign_suggestion: boolean;
    assigned_suggestion_reason?: string;
  };
  'issues_stream.issue_category_dropdown_changed': {
    category: string;
  };
  'issues_stream.issue_clicked': IssueStream;
  'issues_stream.paginate': {
    direction: string;
  };
  'issues_stream.realtime_clicked': {
    enabled: boolean;
  };
  'issues_stream.sort_changed': {
    sort: string;
  };
  'issues_tab.viewed': {
    num_issues: number;
    num_new_issues: number;
    num_old_issues: number;
    num_perf_issues: number;
    page: number;
    query: string;
    tab?: string;
  };
  'quick_trace.connected_services': {
    projects: number;
  };
  'quick_trace.dropdown.clicked': {
    node_key: string;
  };
  'quick_trace.dropdown.clicked_extra': {
    node_key: string;
  };
  'quick_trace.missing_service.dismiss': {
    platform: string;
  };
  'quick_trace.missing_service.docs': {
    platform: string;
  };
  'quick_trace.node.clicked': {
    node_key: string;
  };
  'quick_trace.trace_id.clicked': {
    source: string;
  };
  resolve_issue: {release: string};
  'source_map_debug.docs_link_clicked': SourceMapDebugParam;
  'source_map_debug.expand_clicked': SourceMapDebugParam;
  'span_view.embedded_child.hide': {};
  'span_view.embedded_child.show': {};
  'tag.clicked': {
    is_clickable: boolean;
  };
};

export type IssueEventKey = keyof IssueEventParameters;

export const issueEventMap: Record<IssueEventKey, string | null> = {
  'event_cause.viewed': null,
  'event_cause.docs_clicked': 'Event Cause Docs Clicked',
  'event_cause.snoozed': 'Event Cause Snoozed',
  'event_cause.dismissed': 'Event Cause Dismissed',
  'issue_details.view_hierarchy.hover_rendering_system':
    'View Hierarchy: Hovered rendering system icon',
  'issue_details.view_hierarchy.select_from_tree': 'View Hierarchy: Selection from tree',
  'issue_details.view_hierarchy.select_from_wireframe':
    'View Hierarchy: Selection from wireframe',
  'issue_error_banner.viewed': 'Issue Error Banner Viewed',
  'issue_error_banner.proguard_misconfigured.displayed':
    'Proguard Potentially Misconfigured Issue Error Banner Displayed',
  'issue_error_banner.proguard_missing_mapping.displayed':
    'Proguard Missing Mapping Issue Error Banner Displayed',
  'issue_error_banner.proguard_misconfigured.clicked':
    'Proguard Potentially Misconfigured Issue Error Banner Link Clicked',
  'issues_tab.viewed': 'Viewed Issues Tab',
  'issue_search.failed': 'Issue Search: Failed',
  'issue_search.empty': 'Issue Search: Empty',
  'issue.search_sidebar_clicked': 'Issue Search Sidebar Clicked',
  'inbox_tab.issue_clicked': 'Clicked Issue from Inbox Tab',
  'issues_stream.realtime_clicked': 'Issues Stream: Realtime Clicked',
  'issues_stream.issue_clicked': 'Clicked Issue from Issues Stream',
  'issues_stream.issue_assigned': 'Assigned Issue from Issues Stream',
  'issues_stream.sort_changed': 'Changed Sort on Issues Stream',
  'issues_stream.paginate': 'Paginate Issues Stream',
  'issues_stream.issue_category_dropdown_changed':
    'Issues Stream: Issue Category Dropdown Changed',
  'issue.shared_publicly': 'Issue Shared Publicly',
  'issue_group_details.stack_traces.setup_source_maps_alert.clicked':
    'Issue Group Details: Setup Source Maps Alert Clicked',
  resolve_issue: 'Resolve Issue',
  'tag.clicked': 'Tag: Clicked',
  'quick_trace.missing_service.dismiss': 'Quick Trace: Missing Service Dismissed',
  'quick_trace.missing_service.docs': 'Quick Trace: Missing Service Clicked',
  'quick_trace.dropdown.clicked': 'Quick Trace: Dropdown clicked',
  'quick_trace.dropdown.clicked_extra': 'Quick Trace: Dropdown clicked',
  'quick_trace.node.clicked': 'Quick Trace: Node clicked',
  'quick_trace.connected_services': 'Quick Trace: Connected Services',
  'quick_trace.trace_id.clicked': 'Quick Trace: Trace ID clicked',
  'span_view.embedded_child.hide': 'Span View: Hide Embedded Transaction',
  'span_view.embedded_child.show': 'Span View: Show Embedded Transaction',
  'issue_group_details.tab.clicked': 'Issue Group Details: Header Tab Clicked',
  'issue_group_details.tags.show_all_tags.clicked':
    'Issue Group Details: Tags show all clicked',
  'issue_group_details.tags.switcher.clicked':
    'Issue Group Details: Tags switcher clicked',
  'issue_group_details.tags.bar.clicked': 'Issue Group Details: Tags value bar clicked',
  'issue_group_details.tags.bar.hovered': 'Issue Group Details: Tags value bar hovered',
  'issue_group_details.tags_distribution.bar.clicked':
    'Issue Group Details: Tags distribution value bar clicked',

  // Performance Issue specific events here
  'issue_details.performance.autogrouped_siblings_toggle':
    'Performance Issue Details: Autogrouped Siblings Toggled',
  'issue_details.performance.hidden_spans_expanded':
    'Performance Issue Details: Hidden Spans Expanded',
  'source_map_debug.docs_link_clicked': 'Source Map Debug: Docs Clicked',
  'source_map_debug.expand_clicked': 'Source Map Debug: Expand Clicked',
  'issue_details.copy_event_link_clicked': 'Issue Details: Copy Event Link Clicked',
  'issue_details.event_details_clicked': 'Issue Details: Full Event Details Clicked',
  'issue_details.header_view_replay_clicked': 'Issue Details: Header View Replay Clicked',
  'issue_details.external_issue_modal_opened':
    'Issue Details: External Issue Modal Opened',
  'issue_details.external_issue_created': 'Issue Details: External Issue Created',
};
