export type IssueEventParameters = {
  'event_cause.viewed': {
    project_id?: string;
    platform?: string;
  };
  'event_cause.docs_clicked': {};
  'event_cause.snoozed': {};
  'event_cause.dismissed': {};
};

export type IssueEventKey = keyof IssueEventParameters;

export const issueEventMap: Record<IssueEventKey, string | null> = {
  'event_cause.viewed': null, // send to reload only due to high event volume
  'event_cause.docs_clicked': 'Event Cause Docs Clicked',
  'event_cause.snoozed': 'Event Cause Snoozed',
  'event_cause.dismissed': 'Event Cause Dismissed',
};
