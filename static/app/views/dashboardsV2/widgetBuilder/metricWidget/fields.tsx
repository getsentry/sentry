import {MetricsMeta, MetricsOperation, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {METRICS_OPERATIONS} from 'sentry/utils/metrics/fields';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

export function generateMetricsWidgetFieldOptions(
  fields: MetricsMeta[] = [],
  tagKeys?: string[]
) {
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  const fieldNames: string[] = [];
  const operations = new Set<MetricsOperation>();
  const knownOperations = Object.keys(METRICS_OPERATIONS);

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
      const defaultField = METRICS_OPERATIONS[operation].defaultValue;

      fieldOptions[`function:${operation}`] = {
        label: `${operation}(${'\u2026'})`,
        value: {
          kind: FieldValueKind.FUNCTION,
          meta: {
            name: operation,
            parameters: [
              {
                kind: 'column',
                columnTypes: METRICS_OPERATIONS[operation].metricsTypes,
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
