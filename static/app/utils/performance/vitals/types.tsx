import type {ColumnType} from 'sentry/utils/discover/fields';
import type {WebVital} from 'sentry/utils/fields';

export interface Vital {
  description: string;
  name: string;
  slug: string;
  type: ColumnType;
  acronym?: string;
  poorThreshold?: number;
}

export interface VitalGroup {
  colors: string[];
  vitals: WebVital[];
  max?: number;
  min?: number;
  precision?: number;
}
