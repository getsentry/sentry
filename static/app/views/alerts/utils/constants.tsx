export const CHANGE_ALERT_CONDITION_IDS = [
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
];

export const CHANGE_ALERT_PLACEHOLDERS_LABELS = {
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition':
    'Number of events in an issue is...',
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition':
    'Number of users affected by an issue is...',
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition':
    'Percent of sessions affected by an issue is...',
};

export const COMPARISON_TYPE_CHOICE_VALUES = {
  count: 'more than {value} in {interval}',
  percent: '{value}% higher in {interval} compared to {comparisonInterval} ago',
};
export const COMPARISON_TYPE_CHOICES: [string, string][] = [
  ['count', COMPARISON_TYPE_CHOICE_VALUES.count],
  ['percent', COMPARISON_TYPE_CHOICE_VALUES.percent],
];
export const COMPARISON_INTERVAL_CHOICES: [string, string][] = [
  ['5m', '5 minutes'],
  ['15m', '15 minutes'],
  ['1h', 'one hour'],
  ['1d', 'one day'],
  ['1w', 'one week'],
  ['30d', '30 days'],
];
