type IssueStream = {
  group_id: string;
  tab: string;
  was_shown_suggestion: boolean;
};

export type IssueEventParameters = {
  'event_cause.viewed': {
    project_id?: string;
    platform?: string;
  };
  'event_cause.docs_clicked': {};
  'event_cause.snoozed': {};
  'event_cause.dismissed': {};
  'issue_error_banner.viewed': {
    error_type: string[];
    error_message: string[];
    group?: string;
    platform?: string;
  };
  'issues_tab.viewed': {
    tab: string;
    num_issues: number;
  };
  'issue_search.failed': {
    search_type: string;
    search_source: string;
    error: string;
  };
  'issue.search_sidebar_clicked': {};
  'inbox_tab.issue_clicked': {
    group_id: string;
  };
  'issues_stream.issue_clicked': IssueStream;
  'issues_stream.issue_assigned': IssueStream & {
    did_assign_suggestion: boolean;
    assigned_type: string;
    assigned_suggestion_reason?: string;
  };
  'issue.shared_publicly': {};
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
