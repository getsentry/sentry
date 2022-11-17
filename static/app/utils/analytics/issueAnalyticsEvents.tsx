type IssueStream = {
  group_id: string;
  tab: string;
  was_shown_suggestion: boolean;
};

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
  'issue.quick_trace_status': {
    is_performance_issue: boolean;
    status: string;
  };
  'issue.search_sidebar_clicked': {};
  'issue.shared_publicly': {};
  'issue_details.performance.autogrouped_siblings_toggle': {};
  'issue_details.performance.hidden_spans_expanded': {};
  'issue_error_banner.viewed': {
    error_message: string[];
    error_type: string[];
    group?: string;
    platform?: string;
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
  'issue_group_details.tags.show_all_tags.clicked': {
    is_mobile: boolean;
    tag: string;
    platform?: string;
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
  resolve_issue: {release: string};
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
  'issue_error_banner.viewed': 'Issue Error Banner Viewed',
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
  'issue.shared_publicly': 'Issue Shared Publicly',
  resolve_issue: 'Resolve Issue',
  'tag.clicked': 'Tag: Clicked',
  'issue.quick_trace_status': 'Issue Quick Trace Status',
  'quick_trace.missing_service.dismiss': 'Quick Trace: Missing Service Dismissed',
  'quick_trace.missing_service.docs': 'Quick Trace: Missing Service Clicked',
  'quick_trace.dropdown.clicked': 'Quick Trace: Dropdown clicked',
  'quick_trace.dropdown.clicked_extra': 'Quick Trace: Dropdown clicked',
  'quick_trace.node.clicked': 'Quick Trace: Node clicked',
  'quick_trace.connected_services': 'Quick Trace: Connected Services',
  'span_view.embedded_child.hide': 'Span View: Hide Embedded Transaction',
  'span_view.embedded_child.show': 'Span View: Show Embedded Transaction',
  'issue_group_details.tab.clicked': 'Issue Group Details: Header Tab Clicked',
  'issue_group_details.tags.show_all_tags.clicked':
    'Issue Group Details: Tags show all clicked',
  'issue_group_details.tags.switcher.clicked':
    'Issue Group Details: Tags switcher clicked',
  'issue_group_details.tags.bar.clicked': 'Issue Group Details: Tags value bar clicked',
  'issue_group_details.tags_distribution.bar.clicked':
    'Issue Group Details: Tags distribution value bar clicked',

  // Performance Issue specific events here
  'issue_details.performance.autogrouped_siblings_toggle':
    'Performance Issue Details: Autogrouped Siblings Toggled',
  'issue_details.performance.hidden_spans_expanded':
    'Performance Issue Details: Hidden Spans Expanded',
};
