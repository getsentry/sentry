import {FieldValueType} from 'sentry/utils/fields';
import type {
  TraceItemAttribute,
  TraceItemAttributeType,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

export type AttributeDataset = 'spans' | 'logs' | 'tracemetrics';

export interface Attribute extends Pick<
  TraceItemAttribute,
  'attributeSource' | 'attributeType' | 'name'
> {
  datasets: AttributeDataset[];
  context?: {
    brief?: string;
    details?: string[];
    examples?: Array<string | number | boolean>;
    isConvention?: boolean;
    isDeprecated?: boolean;
    replacementAttribute?: string;
  };
}

export const ATTRIBUTE_VALUE_TYPES: Record<TraceItemAttributeType, FieldValueType> = {
  string: FieldValueType.STRING,
  number: FieldValueType.NUMBER,
  boolean: FieldValueType.BOOLEAN,
  array: FieldValueType.ARRAY,
};

export const ATTRIBUTES_STATS_PERIOD = '14d';

export function isAttributeType(
  value: string | undefined
): value is TraceItemAttributeType {
  return value !== undefined && Object.hasOwn(ATTRIBUTE_VALUE_TYPES, value);
}
