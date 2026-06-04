import type {ColumnType} from 'sentry/utils/discover/fields';

export type Vital = {
  description: string;
  name: string;
  slug: string;
  type: ColumnType;
  acronym?: string;
  poorThreshold?: number;
};
