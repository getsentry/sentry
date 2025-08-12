import type {Sort} from 'sentry/utils/discover/fields';
import type {WritableAggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import type {Mode} from 'sentry/views/explore/queryParams/mode';

export interface WritableQueryParams {
  aggregateCursor?: string;
  aggregateFields?: readonly WritableAggregateField[];
  aggregateSortBys?: readonly Sort[];
  cursor?: string;
  fields?: string[];
  mode?: Mode;
  query?: string;
  sortBys?: Sort[];
}
