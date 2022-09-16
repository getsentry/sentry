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
  'issues_stream.count_perf_issues': {
    num_perf_issues: number;
    num_total_issues: number;
    page: number;
    query: string;
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
    tab: string;
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
  'event_cause.viewed': null, // send to main event store only due to high event volume
  'event_cause.docs_clicked': 'Event Cause Docs Clicked',
  'event_cause.snoozed': 'Event Cause Snoozed',
  'event_cause.dismissed': 'Event Cause Dismissed',
  'issue_error_banner.viewed': 'Issue Error Banner Viewed',
  'issues_tab.viewed': 'Viewed Issues Tab', // high volume but send to our secondary event store anyways
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
  'span_view.embedded_child.hide': 'Span View: Hide Embedded Transaction',
  'span_view.embedded_child.show': 'Span View: Show Embedded Transaction',

  // Performance Issue specific events here
  'issue_details.performance.autogrouped_siblings_toggle':
    'Performance Issue Details: Autogrouped Siblings Toggled',
  'issue_details.performance.hidden_spans_expanded':
    'Performance Issue Details: Hidden Spans Expanded',
  'issues_stream.count_perf_issues':
    'Issues Stream: Number of Performance Issues on Current Page',
};
