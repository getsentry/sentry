import {parse} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/grammar.pegjs';
import {
  TokenConverter,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';

/**
 * This parser is specifically meant for parsing the value of a date filter.
 * This should mirror the grammar used for search syntax, but we cannot
 * use it directly since the grammar is designed to parse the entire search query
 * and will fail if we just pass in a date value.
 */
export function parseFilterValueDate(
  query: string
): TokenResult<Token.VALUE_ISO_8601_DATE | Token.VALUE_RELATIVE_DATE> | null {
  try {
    return parse(query, {
      TokenConverter,
      config: {parse: true},
      startRule: 'date',
    });
  } catch (e) {
    return null;
  }
}
