import {ColumnType} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';

export type Vital = {
  description: string;
  name: string;
  slug: string;
  type: ColumnType;
  acronym?: string;
  poorThreshold?: number;
};

export type VitalGroup = {
  colors: string[];
  vitals: WebVital[];
  max?: number;
  min?: number;
  precision?: number;
};
