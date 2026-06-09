/**
 * Basic types that are required to build types in other type modules.
 *
 * Before a type is put here it should be required in multiple other types.
 * or used in multiple views.
 */
import type {getInterval} from 'sentry/components/charts/utils';
import type {DateString} from 'sentry/types/coreBase';

export type {Scope} from 'sentry/constants/scopes';
export {DataCategory, DataCategoryExact} from 'sentry/types/dataCategory';
export type {DataCategoryInfo} from 'sentry/types/dataCategory';

export type IntervalPeriod = ReturnType<typeof getInterval>;

export type PageFilters = {
  /**
   * Currently selected time filter
   */
  datetime: {
    end: DateString | null;
    period: string | null;
    start: DateString | null;
    utc: boolean | null;
  };
  /**
   * Currently selected environment names
   */
  environments: string[];
  /**
   * Currently selected Project IDs
   */
  projects: number[];
};
