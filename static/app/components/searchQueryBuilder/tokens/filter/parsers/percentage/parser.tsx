import {parse} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/grammar.pegjs';

type PercentageTokenValue = {
  value: string;
  unit?: string;
};

/**
 * This parser is specifically meant for parsing the value of a percentage filter.
 * This should mostly mirror the grammar used for search syntax, but is a little
 * more lenient. This parser still returns a valid result even if the percentage
 * does not contain "%".
 */
export function parseFilterValuePercentage(query: string): PercentageTokenValue | null {
  try {
    return parse(query, {startRule: 'percentage'});
  } catch (e) {
    return null;
  }
}
