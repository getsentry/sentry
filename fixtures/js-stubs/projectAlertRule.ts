import {IssueAlertRule} from 'sentry/types/alerts';

export function ProjectAlertRule(params: Partial<IssueAlertRule> = {}): IssueAlertRule {
  return {
    id: '1',
    name: 'My alert rule',
    environment: 'staging',
    actionMatch: 'all',
    filterMatch: 'all',
    conditions: [
      {name: 'An alert is first seen', id: 'sentry.rules.conditions.1', label: ''},
    ],
    actions: [
      {
        name: 'Send a notification to all services',
        id: 'sentry.rules.actions.notify1',
        label: '',
      },
    ],
    filters: [],
    createdBy: null,
    dateCreated: '',
    projects: [],
    snooze: false,
    frequency: 1,
    ...params,
  };
}
