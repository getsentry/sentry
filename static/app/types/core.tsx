/**
 * Basic types that are required to build types in other type modules.
 *
 * Before a type is put here it should be required in multiple other types.
 * or used in multiple views.
 */
import type {getInterval} from 'sentry/components/charts/utils';
import type {DateString} from 'sentry/types/coreBase';
export type {DateString};
export {Outcome} from 'sentry/types/coreBase';
export type {
  Actor,
  Avatar,
  Choice,
  Choices,
  ObjectStatus,
  PinnedPageFilter,
} from 'sentry/types/coreBase';

export type {Scope} from 'sentry/constants/scopes';
export {DataCategory, DataCategoryExact} from 'sentry/types/dataCategory';
export type {DataCategoryInfo} from 'sentry/types/dataCategory';

/**
 * Visual representation of a project/team/organization/user
 */
/**
 * Simple timeseries data used in groups, projects and release health.
 */
// taken from https://stackoverflow.com/questions/46634876/how-can-i-change-a-readonly-property-in-typescript
/**
 * The 'other' option format used by checkboxes, radios and more.
 */
export type IntervalPeriod = ReturnType<typeof getInterval>;

/**
 * Represents a pinned page filter sentinel value
 */
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
