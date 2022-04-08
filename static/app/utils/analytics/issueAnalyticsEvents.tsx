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
  'issue.search_sidebar_clicked': {};
  'issue.shared_publicly': {};
  'issue_error_banner.viewed': {
    error_message: string[];
    error_type: string[];
    group?: string;
    platform?: string;
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
  'issues_tab.viewed': {
    num_issues: number;
    tab: string;
  };
  resolve_issue: {release: string};
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
  'issue.search_sidebar_clicked': 'Issue Search Sidebar Clicked',
  'inbox_tab.issue_clicked': 'Clicked Issue from Inbox Tab',
  'issues_stream.issue_clicked': 'Clicked Issue from Issues Stream',
  'issues_stream.issue_assigned': 'Assigned Issue from Issues Stream',
  'issue.shared_publicly': 'Issue Shared Publicly',
  resolve_issue: 'Resolve Issue',
  'tag.clicked': 'Tag: Clicked',
};
