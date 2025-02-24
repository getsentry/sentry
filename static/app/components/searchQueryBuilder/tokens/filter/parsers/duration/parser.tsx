import grammar from './grammar.pegjs';

type DurationTokenValue = {
  value: string;
  unit?: string;
};

/**
 * This parser is specifically meant for parsing the value of a duration filter.
 * This should mostly mirror the grammar used for search syntax, but is a little
 * more lenient. This parser still returns a valid result if the duration does
 * not contain a unit which can be used to help create a valid duration or show
 * search suggestions.
 */
export function parseFilterValueDuration(query: string): DurationTokenValue | null {
  try {
    return grammar.parse(query);
  } catch (e) {
    return null;
  }
}
