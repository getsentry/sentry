import {ColumnType, WebVital} from 'app/utils/discover/fields';

export type Vital = {
  slug: string;
  name: string;
  acronym: string;
  description: string;
  poorThreshold: number;
  type: ColumnType;
};

export type VitalGroup = {
  vitals: WebVital[];
  colors: string[];
  min?: number;
  max?: number;
  precision?: number;
};
