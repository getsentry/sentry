import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';

/**
 * Replaces the focused parameter (at cursorPosition) with the new value.
 * If cursorPosition is null, will default to the end of the string.
 *
 * Example:
 * replaceCommaSeparatedValue('foo,bar,baz', 5, 'new') => 'foo,new,baz'
 */
export function replaceCommaSeparatedValue(
  value: string,
  cursorPosition: number | null,
  replacement: string
) {
  const parsed = parseMultiSelectFilterValue(value);

  if (!parsed) {
    return value;
  }

  if (cursorPosition === null) {
    cursorPosition = value.length;
  }

  const matchingIndex = parsed.items.findIndex(
    item =>
      item.value &&
      item.value?.location.start.offset <= cursorPosition &&
      item.value?.location.end.offset >= cursorPosition
  );

  if (matchingIndex === -1) {
    return replacement;
  }

  return [
    ...parsed.items.slice(0, matchingIndex).map(item => item.value?.text ?? ''),
    replacement,
    ...parsed.items.slice(matchingIndex + 1).map(item => item.value?.text ?? ''),
  ].join(',');
}
