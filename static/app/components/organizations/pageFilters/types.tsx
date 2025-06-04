/**
 * A flat object of stringified page filter data
 *
 * XXX: Note the stringified version of the page filter represents `period` as
 * `statsPeriod`
 */
export type PageFiltersStringified = {
  end?: string | null;
  environment?: string[] | null;
  project?: string[] | null;
  start?: string | null;
  statsPeriod?: string | null;
  utc?: string | null;
};

/**
 * This is a flat normalized variant of the PageFilters type.
 */
export type PageFiltersState = {
  end: Date | null;
  environment: string[] | null;
  period: string | null;
  project: number[] | null;
  start: Date | null;
  utc: boolean | null;
};
