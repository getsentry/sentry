import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

export type MetricsColumnType = 'set' | 'counter' | 'duration';

export const METRICS_FIELDS: Readonly<Partial<Record<SessionMetric, MetricsColumnType>>> =
  {
    [SessionMetric.SENTRY_SESSIONS_SESSION]: 'counter',
    [SessionMetric.SENTRY_SESSIONS_SESSION_ERROR]: 'set',
    [SessionMetric.SENTRY_SESSIONS_USER]: 'set',
  };

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
  fields: Record<string, MetricsColumnType> = METRICS_FIELDS,
  tagKeys?: string[]
) {
  const aggregations = METRICS_AGGREGATIONS;
  const fieldKeys = Object.keys(fields).sort();
  const functions = Object.keys(aggregations);
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

  fieldKeys.forEach(field => {
    fieldOptions[`field:${field}`] = {
      label: field,
      value: {
        kind: FieldValueKind.METRICS,
        meta: {
          name: field,
          dataType: fields[field],
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
