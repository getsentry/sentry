import {MutableSearch} from 'sentry/utils/tokenizeSearch';

/**
 * Replace any existing bounds on an attribute in an Explore search query with
 * the half-open range `[min, max)`
 */
export function setExploreAttributeBounds(
  query: string,
  attribute: string,
  min: number,
  max: number
): string {
  const search = new MutableSearch(query);
  // `shouldEscape` is off so the comparison operators (`>=`, `<`) aren't quoted.
  search.setFilterValues(
    attribute,
    [`>=${formatSearchNumber(min)}`, `<${formatSearchNumber(max)}`],
    false
  );
  return search.formatString();
}

/**
 * The search grammar has no exponent syntax, so `1e-7` must be written out as
 * `0.0000001`.
 */
function formatSearchNumber(value: number): string {
  return value.toLocaleString('en-US', {useGrouping: false, maximumFractionDigits: 20});
}
