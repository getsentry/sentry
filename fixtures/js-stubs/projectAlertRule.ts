import {IssueAlertRule} from 'sentry/types/alerts';

export function ProjectAlertRule(params: Partial<IssueAlertRule> = {}): IssueAlertRule {
  return {
    id: '1',
    name: 'My alert rule',
    environment: 'staging',
    actionMatch: 'all',
    filterMatch: 'all',
    conditions: [
      {
        id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
        name: 'A new issue is created',
      },
    ],
    actions: [
      {
        id: 'sentry.rules.actions.notify_event.NotifyEventAction',
        name: 'Send a notification (for all legacy integrations)',
      },
    ],
    filters: [],
    createdBy: null,
    dateCreated: '',
    projects: [],
    snooze: false,
    frequency: 1,
    status: 'active',
    ...params,
  };
}
