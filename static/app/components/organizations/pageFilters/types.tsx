import {DateString} from 'sentry/types';

/**
 * A flat object of stringified page filter data
 *
 * XXX: Note the stringified version of the page filter represents `period` as
 * `statsPeriod`
 */
export type PageFiltersStringified = {
  project?: string[] | null;
  environment?: string[] | null;
  start?: string | null;
  end?: string | null;
  statsPeriod?: string | null;
  utc?: string | null;
};

/**
 * This is a flat normalized variant of the PageFilters type.
 */
export type PageFiltersState = {
  project: number[] | null;
  environment: string[] | null;
  period: string | null;
  start: Date | null;
  end: Date | null;
  utc: boolean | null;
};

/**
 * This is the 'update' object used for updating the page filters. The types
 * here are a bit wider to allow for easy updates.
 */
export type PageFiltersUpdate = {
  project?: Array<string | number> | null;
  environment?: string[] | null;
  start?: DateString;
  end?: DateString;
  utc?: string | boolean | null;
  period?: string | null;
};
