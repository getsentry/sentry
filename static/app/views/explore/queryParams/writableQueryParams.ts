import type {Sort} from 'sentry/utils/discover/fields';
import type {WritableAggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import type {Mode} from 'sentry/views/explore/queryParams/mode';

export interface WritableQueryParams {
  aggregateCursor?: string | null;
  aggregateFields?: readonly WritableAggregateField[] | null;
  aggregateSortBys?: readonly Sort[] | null;
  cursor?: string | null;
  fields?: string[] | null;
  mode?: Mode | null;
  query?: string | null;
  sortBys?: Sort[] | null;
}
