import {
  SelectValue,
  SessionAggregationColumn,
  SessionField,
  SessionsMeta,
  SessionsOperation,
  SessionStatus,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

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
  [DerivedStatusFields.HEALTHY_SESSIONS]: 'session.healthy',
  [DerivedStatusFields.HEALTHY_USERS]: 'session.healthy_user',
  [DerivedStatusFields.ABNORMAL_SESSIONS]: 'session.abnormal',
  [DerivedStatusFields.ABNORMAL_USERS]: 'session.abnormal_user',
  [DerivedStatusFields.CRASHED_SESSIONS]: 'session.crashed',
  [DerivedStatusFields.CRASHED_USERS]: 'session.crashed_user',
  [DerivedStatusFields.ERRORED_SESSIONS]: 'session.errored',
  [DerivedStatusFields.ERRORED_USERS]: 'session.errored_user',
  'count_unique(user)': 'count_unique(sentry.sessions.user)',
  'sum(session)': 'sum(sentry.sessions.session)',
  'crash_free_rate(session)': 'session.crash_free_rate',
  'crash_free_rate(user)': 'session.crash_free_user_rate',
  'crash_rate(session)': 'session.crash_rate',
  'crash_rate(user)': 'session.crash_user_rate',
  project: 'project_id',
};

export const METRICS_EXPRESSION_TO_FIELD = {
  'session.healthy': [DerivedStatusFields.HEALTHY_SESSIONS],
  'session.healthy_user': [DerivedStatusFields.HEALTHY_USERS],
  'session.abnormal': [DerivedStatusFields.ABNORMAL_SESSIONS],
  'session.abnormal_user': [DerivedStatusFields.ABNORMAL_USERS],
  'session.crashed': [DerivedStatusFields.CRASHED_SESSIONS],
  'session.crashed_user': [DerivedStatusFields.CRASHED_USERS],
  'session.errored': [DerivedStatusFields.ERRORED_SESSIONS],
  'session.errored_user': [DerivedStatusFields.ERRORED_USERS],
  'count_unique(sentry.sessions.user)': 'count_unique(user)',
  'sum(sentry.sessions.session)': 'sum(session)',
  'session.crash_free_rate': 'crash_free_rate(session)',
  'session.crash_free_user_rate': 'crash_free_rate(user)',
  'session.crash_rate': 'crash_rate(session)',
  'session.crash_user_rate': 'crash_rate(user)',
  project_id: 'project',
};

export const DISABLED_SORT = [
  'count_errored(session)',
  'count_errored(user)',
  'count_healthy(session)',
  'count_healthy(user)',
  'session.status',
];

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
    columnTypes: ['integer'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['string'],
    defaultValue: SessionField.USER,
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
    columnTypes: ['integer', 'string'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['integer', 'string'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['integer', 'string'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['integer', 'string'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['integer', 'string'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['integer', 'string'],
    defaultValue: SessionField.SESSION,
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
    columnTypes: ['duration'],
    defaultValue: SessionField.SESSION_DURATION,
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
    columnTypes: ['duration'],
    defaultValue: SessionField.SESSION_DURATION,
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
    columnTypes: ['duration'],
    defaultValue: SessionField.SESSION_DURATION,
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
    columnTypes: ['duration'],
    defaultValue: SessionField.SESSION_DURATION,
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
    columnTypes: ['duration'],
    defaultValue: SessionField.SESSION_DURATION,
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
    columnTypes: ['duration'],
    defaultValue: SessionField.SESSION_DURATION,
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
export const SESSION_STATUSES = Object.values(SessionStatus);

export function generateReleaseWidgetFieldOptions(
  fields: SessionsMeta[] = Object.values(SESSIONS_FIELDS),
  tagKeys?: string[]
) {
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  const fieldNames: string[] = [];
  const operations = new Set<SessionsOperation>();
  const knownOperations = Object.keys(SESSIONS_OPERATIONS);

  // If there are no fields, we do not want to render aggregations, nor tags
  // Metrics API needs at least one field to be able to return data
  if (fields.length === 0) {
    return {};
  }

  fields
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(field => {
      field.operations.forEach(operation => operations.add(operation));
      fieldNames.push(field.name);

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
    tagKeys
      .sort((a, b) => a.localeCompare(b))
      .forEach(tag => {
        fieldOptions[`tag:${tag}`] = {
          label: tag,
          value: {
            kind: FieldValueKind.TAG,
            meta: {name: tag, dataType: 'string'},
          },
        };
      });
  }

  return fieldOptions;
}
