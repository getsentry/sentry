import grammar from './grammar.pegjs';

type DurationTokenValue = {
  value: string;
  unit?: string;
};

/**
 * This parser is specifically meant for parsing the value of a percentage filter.
 * This should mostly mirror the grammar used for search syntax, but is a little
 * more lenient. This parser still returns a valid result even if the percentage
 * does not contain "%".
 */
export function parseFilterValuePercentage(query: string): DurationTokenValue | null {
  try {
    return grammar.parse(query);
  } catch (e) {
    return null;
  }
}
