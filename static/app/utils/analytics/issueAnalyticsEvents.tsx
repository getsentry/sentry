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
  'search.searched': {
    query: string;
    search_type: string;
    search_source: string;
  };
  'organization_saved_search.selected': {
    search_type: string;
    id: number;
  };
  'issue.search_sidebar_clicked': {};
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
  'search.searched': 'Search: Performed search',
  'organization_saved_search.selected':
    'Organization Saved Search: Selected saved search',
  'issue.search_sidebar_clicked': 'Issue Search Sidebar Clicked',
};
