import grammar from './grammar.pegjs';

type SizeTokenValue = {
  value: string;
  unit?: string;
};

/**
 * This parser is specifically meant for parsing the value of a size filter.
 * This should mostly mirror the grammar used for search syntax, but is a little
 * more lenient. This parser still returns a valid result if the size does
 * not contain a unit which can be used to help create a valid size or show
 * search suggestions.
 */
export function parseFilterValueSize(query: string): SizeTokenValue | null {
  try {
    return grammar.parse(query);
  } catch (e) {
    return null;
  }
}
