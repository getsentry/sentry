import {ColumnType, WebVital} from 'sentry/utils/discover/fields';

export interface Vital {
  slug: string;
  name: string;
  acronym?: string;
  description: string;
  poorThreshold?: number;
  type: ColumnType;
}

export interface VitalGroup {
  vitals: WebVital[];
  colors: string[];
  min?: number;
  max?: number;
  precision?: number;
}
