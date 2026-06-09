import type {Sort} from 'sentry/utils/discover/fields';
import type {WritableAggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
import type {Mode} from 'sentry/views/explore/queryParams/mode';
import type {ExploreTable} from 'sentry/views/explore/queryParams/readableQueryParams';

export interface WritableQueryParams {
  aggregateCursor?: string | null;
  aggregateFields?: readonly WritableAggregateField[] | null;
  aggregateSortBys?: readonly Sort[] | null;
  crossEvents?: readonly CrossEvent[] | null;
  cursor?: string | null;
  extrapolate?: boolean;
  fields?: string[] | null;
  interval?: string | null;
  mode?: Mode | null;
  query?: string | null;
  sortBys?: Sort[] | null;
  table?: ExploreTable | null;
}
