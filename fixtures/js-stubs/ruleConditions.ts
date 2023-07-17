const DEFAULT_INTERVAL_CHOICES = [
  ['1m', 'one minute'],
  ['1h', 'one hour'],
  ['1d', 'one day'],
  ['1w', 'one week'],
  ['30d', '30 days'],
];
const DEFAULT_PLACEHOLDER = 100;
const EVENT_FREQUENCY_CONDITION =
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition';
const UNIQUE_USER_FREQUENCY_CONDITION =
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition';

export const MOCK_RESP_VERBOSE = [
  {
    id: 'sentry.rules.conditions.every_event.EveryEventCondition',
    label: 'An event occurs',
  },
  {
    id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
    label: 'A new issue is created',
  },
  {
    id: 'sentry.rules.conditions.regression_event.RegressionEventCondition',
    label: 'The issue changes state from resolved to unresolved',
  },
  {
    id: 'sentry.rules.conditions.reappeared_event.ReappearedEventCondition',
    label: 'The issue changes state from ignored to unresolved',
  },
  {
    formFields: {
      value: {
        placeholder: 'value',
        type: 'string',
      },
      match: {
        type: 'choice',
        choices: [
          ['eq', 'equals'],
          ['ne', 'does not equal'],
          ['sw', 'starts with'],
          ['ew', 'ends with'],
          ['co', 'contains'],
          ['nc', 'does not contain'],
          ['is', 'is set'],
          ['ns', 'is not set'],
        ],
      },
      key: {
        placeholder: 'key',
        type: 'string',
      },
    },
    id: 'sentry.rules.conditions.tagged_event.TaggedEventCondition',
    label: "An event's tags match {key} {match} {value}",
  },
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: DEFAULT_INTERVAL_CHOICES,
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: EVENT_FREQUENCY_CONDITION,
    label: 'The issue is seen more than {value} times in {interval}',
  },
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: DEFAULT_INTERVAL_CHOICES,
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: UNIQUE_USER_FREQUENCY_CONDITION,
    label: 'The issue is seen by more than {value} users in {interval}',
  },
  {
    formFields: {
      attribute: {
        placeholder: 'i.e. exception.type',
        type: 'choice',
        choices: [
          ['message', 'message'],
          ['platform', 'platform'],
          ['environment', 'environment'],
          ['type', 'type'],
          ['exception.type', 'exception.type'],
          ['exception.value', 'exception.value'],
          ['user.id', 'user.id'],
          ['user.email', 'user.email'],
          ['user.username', 'user.username'],
          ['user.ip_address', 'user.ip_address'],
          ['http.method', 'http.method'],
          ['http.url', 'http.url'],
          ['stacktrace.code', 'stacktrace.code'],
          ['stacktrace.module', 'stacktrace.module'],
          ['stacktrace.filename', 'stacktrace.filename'],
        ],
      },
      value: {
        placeholder: 'value',
        type: 'string',
      },
      match: {
        type: 'choice',
        choices: [
          ['eq', 'equals'],
          ['ne', 'does not equal'],
          ['sw', 'starts with'],
          ['ew', 'ends with'],
          ['co', 'contains'],
          ['nc', 'does not contain'],
          ['is', 'is set'],
          ['ns', 'is not set'],
        ],
      },
    },
    id: 'sentry.rules.conditions.event_attribute.EventAttributeCondition',
    label: "An event's {attribute} value {match} {value}",
  },
  {
    formFields: {
      match: {
        type: 'choice',
        choices: [
          ['eq', 'equal to'],
          ['lte', 'less than or equal to'],
          ['gte', 'greater than or equal to'],
        ],
      },
      level: {
        type: 'choice',
        choices: [
          ['50', 'fatal'],
          ['40', 'error'],
          ['30', 'warning'],
          ['20', 'info'],
          ['10', 'debug'],
          ['0', 'sample'],
        ],
      },
    },
    id: 'sentry.rules.conditions.level.LevelCondition',
    label: "An event's level is {match} {level}",
  },
];

export const MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID = [
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: [['@*(&^#$!', 'Invalid choice']],
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: 'cinnamon.rules.conditions.infinite_eclair.A19SeanBanIsabelle',
    label: 'The issue is seen more than {value} times in {interval}',
  },
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: [
          ['1m', 'one minute'],
          ['1h', 'one hour'],
          ['30d', '30 days'],
        ],
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: UNIQUE_USER_FREQUENCY_CONDITION,
    label: 'The issue is seen by more than {value} users in {interval}',
  },
];

export const MOCK_RESP_INCONSISTENT_PLACEHOLDERS = [
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: DEFAULT_INTERVAL_CHOICES,
      },
      value: {
        placeholder: 80696,
        type: 'number',
      },
    },
    id: EVENT_FREQUENCY_CONDITION,
    label: 'The issue is seen more than {value} times in {interval}',
  },
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: DEFAULT_INTERVAL_CHOICES,
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: UNIQUE_USER_FREQUENCY_CONDITION,
    label: 'The issue is seen by more than {value} users in {interval}',
  },
];

export const MOCK_RESP_INCONSISTENT_INTERVALS = [
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: [
          ['1m', 'one minute'],
          ['1h', 'one hour'],
          ['12h', 'high noon'],
          ['1d', 'one day'],
          ['1w', 'one week'],
          ['30d', '30 days'],
        ],
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: EVENT_FREQUENCY_CONDITION,
    label: 'The issue is seen more than {value} times in {interval}',
  },
  {
    formFields: {
      interval: {
        type: 'choice',
        choices: DEFAULT_INTERVAL_CHOICES,
      },
      value: {
        placeholder: DEFAULT_PLACEHOLDER,
        type: 'number',
      },
    },
    id: UNIQUE_USER_FREQUENCY_CONDITION,
    label: 'The issue is seen by more than {value} users in {interval}',
  },
];
