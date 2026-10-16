/**
 * Explore saved queries still persist the relative period as `range`.
 * Copy `statsPeriod` onto that field when saving.
 */
export function withSavedQueryStatsPeriod<T extends {statsPeriod?: string | null}>(
  query: T
): T & {range?: string} {
  return {
    ...query,
    range: query.statsPeriod ?? undefined,
  };
}
