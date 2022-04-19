import {
  SelectValue,
  SessionAggregationColumn,
  SessionMetric,
  SessionsMeta,
  SessionsOperation,
  SessionStatus,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

export const SESSIONS_FIELDS: Readonly<Partial<Record<SessionMetric, SessionsMeta>>> = {
  [SessionMetric.SESSION]: {
    name: 'session',
    operations: ['sum'],
    type: 'integer',
  },
  [SessionMetric.USER]: {
    name: 'user',
    operations: ['count_unique'],
    type: 'string',
  },
  [SessionMetric.SESSION_DURATION]: {
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
    defaultValue: SessionMetric.SESSION,
    outputType: 'integer',
  },
  count_unique: {
    columnTypes: ['string'],
    defaultValue: SessionMetric.USER,
    outputType: 'integer',
  },
  avg: {
    columnTypes: ['duration'],
    defaultValue: SessionMetric.SESSION_DURATION,
    outputType: null,
  },
  max: {
    columnTypes: ['duration'],
    defaultValue: SessionMetric.SESSION_DURATION,
    outputType: null,
  },
  p50: {
    columnTypes: ['duration'],
    defaultValue: SessionMetric.SESSION_DURATION,
    outputType: null,
  },
  p75: {
    columnTypes: ['duration'],
    defaultValue: SessionMetric.SESSION_DURATION,
    outputType: null,
  },
  p95: {
    columnTypes: ['duration'],
    defaultValue: SessionMetric.SESSION_DURATION,
    outputType: null,
  },
  p99: {
    columnTypes: ['duration'],
    defaultValue: SessionMetric.SESSION_DURATION,
    outputType: null,
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
      const defaultField = SESSIONS_OPERATIONS[operation].defaultValue;

      fieldOptions[`function:${operation}`] = {
        label: `${operation}(${'\u2026'})`,
        value: {
          kind: FieldValueKind.FUNCTION,
          meta: {
            name: operation,
            parameters: [
              {
                kind: 'column',
                columnTypes: SESSIONS_OPERATIONS[operation].columnTypes,
                required: true,
                defaultValue: fieldNames.includes(defaultField)
                  ? defaultField
                  : fields.find(field => field.operations.includes(operation))?.name ??
                    '',
              },
            ],
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
