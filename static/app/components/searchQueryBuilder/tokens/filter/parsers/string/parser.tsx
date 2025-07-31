import {
  type SearchConfig,
  type Token,
  TokenConverter,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';

import grammar from './grammar.pegjs';

/**
 * Parses the user input value of a multi select filter.
 *
 * This is different from the search syntax parser in the following ways:
 * - Does not look for surrounding []
 * - Does not disallow spaces or parens outside of quoted values
 */
export function parseMultiSelectFilterValue(
  value: string,
  config?: Partial<SearchConfig>
): TokenResult<Token.VALUE_TEXT_LIST> | null {
  try {
    return grammar.parse(value, {TokenConverter, config});
  } catch (e) {
    return null;
  }
}
