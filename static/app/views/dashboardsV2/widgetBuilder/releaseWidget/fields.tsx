import {
  SelectValue,
  SessionAggregationColumn,
  SessionsMeta,
  SessionsOperation,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

export const SESSION_FIELDS: Record<string, SessionsMeta> = {
  session: {
    name: 'session',
    operations: ['sum'],
    type: 'integer',
  },
  user: {
    name: 'user',
    operations: ['count_unique'],
    type: 'string',
  },
  'session.duration': {
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
    defaultValue: 'session',
    outputType: 'integer',
  },
  count_unique: {
    columnTypes: ['string'],
    defaultValue: 'user',
    outputType: 'integer',
  },
  avg: {
    columnTypes: ['duration'],
    defaultValue: 'session.duration',
    outputType: null,
  },
  max: {
    columnTypes: ['duration'],
    defaultValue: 'session.duration',
    outputType: null,
  },
  p50: {
    columnTypes: ['duration'],
    defaultValue: 'session.duration',
    outputType: null,
  },
  p75: {
    columnTypes: ['duration'],
    defaultValue: 'session.duration',
    outputType: null,
  },
  p95: {
    columnTypes: ['duration'],
    defaultValue: 'session.duration',
    outputType: null,
  },
  p99: {
    columnTypes: ['duration'],
    defaultValue: 'session.duration',
    outputType: null,
  },
};

export const SESSION_TAGS = ['environment', 'project', 'release', 'session.status'];

export function generateReleaseWidgetFieldOptions(
  fields: SessionsMeta[] = Object.keys(SESSION_FIELDS).map(key => SESSION_FIELDS[key]),
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
