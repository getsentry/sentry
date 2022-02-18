import {MetricMeta, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

export const METRICS_FIELDS_ALLOW_LIST: string[] = [
  SessionMetric.SENTRY_SESSIONS_SESSION,
  SessionMetric.SENTRY_SESSIONS_SESSION_DURATION,
  SessionMetric.SENTRY_SESSIONS_USER,
];

export const DEFAULT_METRICS_FIELDS: MetricMeta[] = [
  {
    name: SessionMetric.SENTRY_SESSIONS_SESSION,
    operations: ['sum'],
    type: 'counter',
  },
];

export const METRICS_AGGREGATIONS = {
  count_unique: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['set'],
        defaultValue: SessionMetric.SENTRY_SESSIONS_USER,
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  sum: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['counter'],
        required: true,
        defaultValue: SessionMetric.SENTRY_SESSIONS_SESSION,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
};

export function generateMetricsWidgetFieldOptions(
  fields: MetricMeta[] = DEFAULT_METRICS_FIELDS,
  tagKeys?: string[]
) {
  const aggregations = METRICS_AGGREGATIONS;
  const functions = Object.keys(aggregations);
  fields.sort((x, y) => x.name.localeCompare(y.name));
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  // Index items by prefixed keys as custom tags can overlap both fields and
  // function names. Having a mapping makes finding the value objects easier
  // later as well.
  functions.forEach(func => {
    const ellipsis = aggregations[func].parameters.length ? '\u2026' : '';
    const parameters = aggregations[func].parameters;

    fieldOptions[`function:${func}`] = {
      label: `${func}(${ellipsis})`,
      value: {
        kind: FieldValueKind.FUNCTION,
        meta: {
          name: func,
          parameters,
        },
      },
    };
  });

  fields.forEach(field => {
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

  if (defined(tagKeys)) {
    tagKeys.sort();
    tagKeys.forEach(tag => {
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
