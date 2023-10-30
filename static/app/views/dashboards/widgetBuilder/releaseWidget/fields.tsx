import invert from 'lodash/invert';

import {
  SelectValue,
  SessionAggregationColumn,
  SessionField,
  SessionsMeta,
  SessionsOperation,
  SessionStatus,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FieldValue, FieldValueKind} from 'sentry/views/discover/table/types';

enum SessionMetric {
  ANR_RATE = 'session.anr_rate',
  FOREGROUND_ANR_RATE = 'session.foreground_anr_rate',
  SESSION_COUNT = 'session.all',
  SESSION_DURATION = 'sentry.sessions.session.duration',
  SESSION_ERROR = 'sentry.sessions.session.error',
  SESSION_CRASH_FREE_RATE = 'session.crash_free_rate',
  USER_CRASH_FREE_RATE = 'session.crash_free_user_rate',
  SESSION_CRASH_RATE = 'session.crash_rate',
  USER_CRASH_RATE = 'session.crash_user_rate',
  USER = 'sentry.sessions.user',
  SESSION_HEALTHY = 'session.healthy',
  USER_HEALTHY = 'session.healthy_user',
  SESSION_ABNORMAL = 'session.abnormal',
  USER_ABNORMAL = 'session.abnormal_user',
  SESSION_CRASHED = 'session.crashed',
  USER_CRASHED = 'session.crashed_user',
  SESSION_ERRORED = 'session.errored',
  USER_ERRORED = 'session.errored_user',
}

export const DERIVED_STATUS_METRICS_PATTERN =
  /count_(abnormal|errored|crashed|healthy)\((user|session)\)/;

export enum DerivedStatusFields {
  HEALTHY_SESSIONS = 'count_healthy(session)',
  HEALTHY_USERS = 'count_healthy(user)',
  ABNORMAL_SESSIONS = 'count_abnormal(session)',
  ABNORMAL_USERS = 'count_abnormal(user)',
  CRASHED_SESSIONS = 'count_crashed(session)',
  CRASHED_USERS = 'count_crashed(user)',
  ERRORED_SESSIONS = 'count_errored(session)',
  ERRORED_USERS = 'count_errored(user)',
}

export const FIELD_TO_METRICS_EXPRESSION = {
  'foreground_anr_rate()': SessionMetric.FOREGROUND_ANR_RATE,
  'anr_rate()': SessionMetric.ANR_RATE,
  'count_healthy(session)': SessionMetric.SESSION_HEALTHY,
  'count_healthy(user)': SessionMetric.USER_HEALTHY,
  'count_abnormal(session)': SessionMetric.SESSION_ABNORMAL,
  'count_abnormal(user)': SessionMetric.USER_ABNORMAL,
  'count_crashed(session)': SessionMetric.SESSION_CRASHED,
  'count_crashed(user)': SessionMetric.USER_CRASHED,
  'count_errored(session)': SessionMetric.SESSION_ERRORED,
  'count_errored(user)': SessionMetric.USER_ERRORED,
  'count_unique(user)': `count_unique(${SessionMetric.USER})`,
  'sum(session)': SessionMetric.SESSION_COUNT,
  'crash_free_rate(session)': SessionMetric.SESSION_CRASH_FREE_RATE,
  'crash_free_rate(user)': SessionMetric.USER_CRASH_FREE_RATE,
  'crash_rate(session)': SessionMetric.SESSION_CRASH_RATE,
  'crash_rate(user)': SessionMetric.USER_CRASH_RATE,
  project: 'project_id',
};

export const METRICS_EXPRESSION_TO_FIELD = invert(FIELD_TO_METRICS_EXPRESSION);

export const DISABLED_SORT = [
  'count_errored(session)',
  'count_errored(user)',
  'count_healthy(session)',
  'count_healthy(user)',
  'session.status',
];

export const TAG_SORT_DENY_LIST = ['project', 'environment'];

export const SESSIONS_FIELDS: Readonly<Partial<Record<SessionField, SessionsMeta>>> = {
  [SessionField.SESSION]: {
    name: 'session',
    operations: [
      'sum',
      'crash_rate',
      'crash_free_rate',
      'count_healthy',
      'count_abnormal',
      'count_crashed',
      'count_errored',
      'anr_rate',
      'foreground_anr_rate',
    ],
    type: 'integer',
  },
  [SessionField.USER]: {
    name: 'user',
    operations: [
      'count_unique',
      'crash_rate',
      'crash_free_rate',
      'count_healthy',
      'count_abnormal',
      'count_crashed',
      'count_errored',
    ],
    type: 'string',
  },
  [SessionField.SESSION_DURATION]: {
    name: 'session.duration',
    operations: [],
    type: 'duration',
  },
};

export const SESSIONS_OPERATIONS: Readonly<
  Record<SessionsOperation, SessionAggregationColumn>
> = {
  anr_rate: {
    outputType: 'percentage',
    parameters: [],
  },
  foreground_anr_rate: {
    outputType: 'percentage',
    parameters: [],
  },
  sum: {
    outputType: 'integer',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
  count_unique: {
    outputType: 'integer',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['string'],
        defaultValue: SessionField.USER,
        required: true,
      },
    ],
  },
  count_healthy: {
    outputType: 'integer',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'string'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
  count_abnormal: {
    outputType: 'integer',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'string'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
  count_crashed: {
    outputType: 'integer',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'string'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
  count_errored: {
    outputType: 'integer',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'string'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
  crash_rate: {
    outputType: 'percentage',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'string'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
  crash_free_rate: {
    outputType: 'percentage',
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'string'],
        defaultValue: SessionField.SESSION,
        required: true,
      },
    ],
  },
};

export const SESSIONS_TAGS = ['environment', 'project', 'release', 'session.status'];
export const SESSIONS_FILTER_TAGS = ['environment', 'project', 'release'];
export const SESSION_STATUSES = Object.values(SessionStatus);

export function generateReleaseWidgetFieldOptions(
  fields: SessionsMeta[] = Object.values(SESSIONS_FIELDS),
  tagKeys?: string[]
) {
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  const operations = new Set<SessionsOperation>();
  const knownOperations = Object.keys(SESSIONS_OPERATIONS);

  fields
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(field => {
      field.operations.forEach(operation => operations.add(operation));

      fieldOptions[`field:${field.name}`] = {
        label: field.name,
        value: {
          kind: FieldValueKind.METRICS,
          meta: {
            name: field.name,
            dataType: field.type,
          },
        },
      };
    });

  Array.from(operations)
    .filter(operation => knownOperations.includes(operation))
    .sort((a, b) => a.localeCompare(b))
    .forEach(operation => {
      fieldOptions[`function:${operation}`] = {
        label: `${operation}(${'\u2026'})`,
        value: {
          kind: FieldValueKind.FUNCTION,
          meta: {
            name: operation,
            parameters: SESSIONS_OPERATIONS[operation].parameters.map(param => param),
          },
        },
      };
    });

  if (defined(tagKeys)) {
    // Expose environment. session.status, project etc. as fields.
    tagKeys
      .sort((a, b) => a.localeCompare(b))
      .forEach(tag => {
        fieldOptions[`field:${tag}`] = {
          label: tag,
          value: {
            kind: FieldValueKind.FIELD,
            meta: {name: tag, dataType: 'string'},
          },
        };
      });
  }

  return fieldOptions;
}
