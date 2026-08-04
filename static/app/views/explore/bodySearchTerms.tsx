import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function getBodySearchTerms(search: MutableSearch, bodyField: string): string[] {
  const terms: string[] = [];

  // Raw text search is stored as a wildcard filter (`*billing*success*`), so
  // split on `*` and highlight each segment rather than the joined string.
  const addSegments = (value: string) => {
    for (const segment of value.split('*')) {
      if (segment) {
        terms.push(segment);
      }
    }
  };

  search.freeText.forEach(addSegments);

  for (const filter of search.getFilterValues(bodyField)) {
    // Skip negated (`!term`) and list (`[a,b]`) filter values: neither is a
    // literal substring that should be highlighted in the body.
    if (!filter.startsWith('!') && !filter.startsWith('[')) {
      addSegments(filter);
    }
  }

  return terms;
}
