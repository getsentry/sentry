// eslint-disable-next-line @sentry/scraps/restrict-types-file -- type-only import from a runtime module; extracting a type leaf would cascade to its many importers
import type {ColumnType} from 'sentry/utils/discover/fields';

export type Vital = {
  description: string;
  name: string;
  slug: string;
  type: ColumnType;
  acronym?: string;
  poorThreshold?: number;
};
