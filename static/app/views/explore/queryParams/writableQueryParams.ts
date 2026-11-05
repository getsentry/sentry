import type {Sort} from 'sentry/utils/discover/fields';

import type {WritableAggregateField} from './aggregateField';
import type {CrossEvent} from './crossEvent';
import type {Mode} from './mode';

export interface WritableQueryParams {
  aggregateCursor?: string | null;
  aggregateFields?: readonly WritableAggregateField[] | null;
  aggregateSortBys?: readonly Sort[] | null;
  breakdownCursor?: string | null;
  breakdownQuery?: string | null;
  crossEvents?: readonly CrossEvent[] | null;
  cursor?: string | null;
  extrapolate?: boolean;
  fields?: string[] | null;
  mode?: Mode | null;
  query?: string | null;
  sortBys?: Sort[] | null;
}
