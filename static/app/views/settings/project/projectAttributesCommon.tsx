import {t} from 'sentry/locale';
import {FieldValueType} from 'sentry/utils/fields';
import type {
  TraceItemAttribute,
  TraceItemAttributeType,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

export type AttributeDataset = 'spans' | 'logs' | 'tracemetrics';

export const DATASET_LABELS: Record<AttributeDataset, string> = {
  spans: t('Spans'),
  logs: t('Logs'),
  tracemetrics: t('Metrics'),
};

export interface Attribute extends Pick<
  TraceItemAttribute,
  'attributeSource' | 'attributeType' | 'name'
> {
  datasets: AttributeDataset[];
  context?: {
    applyScrubbing?: {
      mode: 'auto' | 'manual' | 'never';
      reason?: string;
    };
    brief?: string;
    details?: string[];
    examples?: Array<string | number | boolean>;
    isConvention?: boolean;
    isCustom?: boolean;
    isDeprecated?: boolean;
    isInOtel?: boolean;
    replacementAttribute?: string;
    unit?: 'byte' | 'currency' | 'millisecond' | 'percentage' | 'second';
  };
}

interface AttributeDatasetStats {
  cardinality: number | null;
  lastSeen: string | null;
  modifiedCount?: number | null;
}

interface AttributeChangelogEntry {
  version: string;
  description?: string;
  prs?: number[];
}

export interface AttributeDetails extends Attribute {
  lastSeen: string | null;
  stats: Partial<Record<AttributeDataset, AttributeDatasetStats>>;
  changelog?: AttributeChangelogEntry[];
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
