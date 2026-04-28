/**
 * This is a flat normalized variant of the PageFilters type.
 */
export interface PageFiltersState {
  end: Date | null;
  environment: string[] | null;
  period: string | null;
  project: number[] | null;
  start: Date | null;
  utc: boolean | null;
}
