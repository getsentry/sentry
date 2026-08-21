import {
  comparisonOperators,
  negationOperators,
  parseSearch,
  TermOperator,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {MutableSearch, TokenType} from 'sentry/utils/tokenizeSearch';

export interface SearchFilter {
  key: string;
  op: TermOperator;
  value: string | number | boolean;
}

function normalizeFilterValue(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return value;
  }

  try {
    return Array.isArray(JSON.parse(trimmedValue)) ? JSON.stringify(value) : value;
  } catch {
    return value;
  }
}

export function addSearchFilterToQuery(
  currentQuery: string,
  filter: SearchFilter
): string {
  const value = normalizeFilterValue(String(filter.value));
  const isNegated = negationOperators.includes(filter.op);
  const key = isNegated ? `!${filter.key}` : filter.key;

  const addFilter = (target: MutableSearch) => {
    switch (filter.op) {
      case TermOperator.CONTAINS:
      case TermOperator.DOES_NOT_CONTAIN:
        target.addContainsFilterValue(key, value);
        break;
      case TermOperator.STARTS_WITH:
      case TermOperator.DOES_NOT_START_WITH:
        target.addStartsWithFilterValue(key, value);
        break;
      case TermOperator.ENDS_WITH:
      case TermOperator.DOES_NOT_END_WITH:
        target.addEndsWithFilterValue(key, value);
        break;
      case TermOperator.NOT_EQUAL:
      case TermOperator.DEFAULT:
        target.addFilterValue(key, value);
        break;
      default:
        target.addFilterValue(key, `${filter.op}${value}`, false);
    }
  };

  const normalizedFilter = new MutableSearch('');
  addFilter(normalizedFilter);
  const normalizedFilterText = normalizedFilter.formatString();
  if (getFilterRows(currentQuery).includes(normalizedFilterText)) {
    return currentQuery;
  }

  return [currentQuery.trim(), normalizedFilterText].filter(Boolean).join(' ');
}

export function getFilterRows(query: string): string[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const tokens = parseSearch(trimmedQuery);
  if (
    !tokens ||
    tokens.some(token => token.type !== Token.FILTER && token.type !== Token.SPACES)
  ) {
    // MutableSearch can recover UI-generated filters with bracketed JSON values that
    // the search syntax parser treats as complex syntax.
    const legacySearch = new MutableSearch(trimmedQuery);
    const legacyFilterTypes = new Set([
      TokenType.FILTER,
      TokenType.CONTAINS_FILTER,
      TokenType.STARTS_WITH_FILTER,
      TokenType.ENDS_WITH_FILTER,
    ]);

    if (
      legacySearch.tokens.length > 0 &&
      legacySearch.tokens.every(token => legacyFilterTypes.has(token.type))
    ) {
      return legacySearch.tokens.map(token => {
        const row = new MutableSearch('');
        row.tokens = [token];
        return row.formatString();
      });
    }

    return [trimmedQuery];
  }

  return tokens.flatMap(token => (token.type === Token.FILTER ? [token.text] : []));
}

export function removeSearchFilterFromQuery(query: string, filterIndex: number): string {
  return getFilterRows(query)
    .filter((_, index) => index !== filterIndex)
    .join(' ');
}

export function replaceSearchFilterInQuery(
  query: string,
  filterIndex: number,
  filter: SearchFilter
): string {
  const filters = getFilterRows(query);
  if (filterIndex < 0 || filterIndex >= filters.length) {
    return query;
  }

  filters[filterIndex] = addSearchFilterToQuery('', filter);
  return filters.join(' ');
}

export function getSearchFilterDescriptor(
  query: string
): {attributeKey: string; operator: TermOperator; value: string} | null {
  const tokens = parseSearch(query);
  const filters = tokens?.filter(token => token.type === Token.FILTER) ?? [];
  if (filters.length !== 1) {
    return null;
  }

  const filter = filters[0]!;
  let operator = filter.operator;
  let value = filter.value.text;
  if (operator === TermOperator.DEFAULT) {
    const comparisonOperator = comparisonOperators.find(candidate =>
      value.startsWith(candidate)
    );
    if (comparisonOperator) {
      operator = comparisonOperator;
      value = value.slice(comparisonOperator.length);
    }
  }
  if (filter.negated) {
    switch (operator) {
      case TermOperator.DEFAULT:
        operator = TermOperator.NOT_EQUAL;
        break;
      case TermOperator.CONTAINS:
        operator = TermOperator.DOES_NOT_CONTAIN;
        break;
      case TermOperator.STARTS_WITH:
        operator = TermOperator.DOES_NOT_START_WITH;
        break;
      case TermOperator.ENDS_WITH:
        operator = TermOperator.DOES_NOT_END_WITH;
        break;
      default:
        break;
    }
  }

  return {attributeKey: filter.key.text, operator, value};
}
