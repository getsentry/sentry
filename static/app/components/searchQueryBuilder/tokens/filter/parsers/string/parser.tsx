import {parse} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/grammar.pegjs';
import {
  TokenConverter,
  type SearchConfig,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';

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
    return parse(value, {TokenConverter, config, startRule: 'text_in_list'});
  } catch (e) {
    return null;
  }
}
