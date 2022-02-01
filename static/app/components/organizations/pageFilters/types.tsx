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
