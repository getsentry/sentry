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
  search.setFilterValues(attribute, [`>=${min}`, `<${max}`], false);
  return search.formatString();
}
