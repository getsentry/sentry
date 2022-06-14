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
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

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
  'count_healthy(session)': SessionMetric.SESSION_HEALTHY,
  'count_healthy(user)': SessionMetric.USER_HEALTHY,
  'count_abnormal(session)': SessionMetric.SESSION_ABNORMAL,
  'count_abnormal(user)': SessionMetric.USER_ABNORMAL,
  'count_crashed(session)': SessionMetric.SESSION_CRASHED,
  'count_crashed(user)': SessionMetric.USER_CRASHED,
  'count_errored(session)': SessionMetric.SESSION_ERRORED,
  'count_errored(user)': SessionMetric.USER_ERRORED,
  'count_unique(user)': `count_unique(${SessionMetric.USER})`,
  'sum(session)': `sum(${SessionMetric.SESSION})`,
  'crash_free_rate(session)': SessionMetric.SESSION_CRASH_FREE_RATE,
  'crash_free_rate(user)': SessionMetric.USER_CRASH_FREE_RATE,
  'crash_rate(session)': SessionMetric.SESSION_CRASH_RATE,
  'crash_rate(user)': SessionMetric.USER_CRASH_RATE,
  'avg(session.duration)': `avg(${SessionMetric.SESSION_DURATION})`,
  'max(session.duration)': `max(${SessionMetric.SESSION_DURATION})`,
  'p50(session.duration)': `p50(${SessionMetric.SESSION_DURATION})`,
  'p75(session.duration)': `p75(${SessionMetric.SESSION_DURATION})`,
  'p95(session.duration)': `p95(${SessionMetric.SESSION_DURATION})`,
  'p99(session.duration)': `p99(${SessionMetric.SESSION_DURATION})`,
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
    operations: ['avg', 'p50', 'p75', 'p95', 'p99', 'max'],
    type: 'duration',
  },
};

export const SESSIONS_OPERATIONS: Readonly<
  Record<SessionsOperation, SessionAggregationColumn>
> = {
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
  avg: {
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: SessionField.SESSION_DURATION,
        required: true,
      },
    ],
  },
  max: {
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: SessionField.SESSION_DURATION,
        required: true,
      },
    ],
  },
  p50: {
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: SessionField.SESSION_DURATION,
        required: true,
      },
    ],
  },
  p75: {
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: SessionField.SESSION_DURATION,
        required: true,
      },
    ],
  },
  p95: {
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: SessionField.SESSION_DURATION,
        required: true,
      },
    ],
  },
  p99: {
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: SessionField.SESSION_DURATION,
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
