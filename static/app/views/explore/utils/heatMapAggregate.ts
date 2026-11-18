import {parseFunction} from 'sentry/utils/discover/fields';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';
import {SpanFields} from 'sentry/views/insights/types';

export const HEATMAP_AGGREGATE = 'heatmap';

export const HEATMAP_FIELD_DEFINITION: FieldDefinition = {
  kind: FieldKind.FUNCTION,
  valueType: FieldValueType.NUMBER,
  parameters: [
    {
      name: 'column',
      kind: 'column',
      columnTypes: [FieldValueType.DURATION, FieldValueType.NUMBER],
      defaultValue: SpanFields.SPAN_DURATION,
      required: true,
    },
  ],
};

export function isHeatMapAggregate(yAxis: string): boolean {
  return parseFunction(yAxis)?.name === HEATMAP_AGGREGATE;
}
