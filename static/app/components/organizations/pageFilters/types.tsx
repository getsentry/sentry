/**
 * A flat object of stringified Sentry and Codecov page filter data
 */
export type PageFiltersStringified = SentryPageFiltersStringified &
  CodecovPageFiltersStringified;

/**
 * A flat object of stringified page filter data
 *
 * XXX: Note the stringified version of the page filter represents `period` as
 * `statsPeriod`
 */
export type SentryPageFiltersStringified = {
  end?: string | null;
  environment?: string[] | null;
  project?: string[] | null;
  start?: string | null;
  statsPeriod?: string | null;
  utc?: string | null;
};

/**
 * A flat object of stringified Codecov page filter data
 */
export type CodecovPageFiltersStringified = {
  repository?: string | null;
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

/**
 * This is a flat normalized variant of the CodecovPageFilters type.
 */
export type CodecovPageFiltersState = {
  repository: string | null;
};
