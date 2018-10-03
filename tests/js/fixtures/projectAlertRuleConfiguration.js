export function ProjectAlertRuleConfiguration(params = {}) {
  return {
    actions: [
      {
        id: 'sentry.rules.actions.notify1',
        label: 'Send a notification for all services',
        enabled: true,
      },
    ],
    conditions: [
      {
        id: 'sentry.rules.conditions.1',
        label: 'An event is seen',
        enabled: true,
      },
    ],
    ...params,
  };
}
