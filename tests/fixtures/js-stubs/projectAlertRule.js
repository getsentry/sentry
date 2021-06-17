export function ProjectAlertRule(params = {}) {
  return {
    id: '1',
    name: 'My alert rule',
    environment: 'staging',
    actionMatch: 'all',
    filterMatch: 'all',
    conditions: [{name: 'An alert is first seen', id: 'sentry.rules.conditions.1'}],
    actions: [
      {name: 'Send a notification to all services', id: 'sentry.rules.actions.notify1'},
    ],
    filters: [],
    ...params,
  };
}
