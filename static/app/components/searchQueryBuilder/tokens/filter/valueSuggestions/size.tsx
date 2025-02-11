import {parseFilterValueSize} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/size/parser';
import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import {Token, type TokenResult} from 'sentry/components/searchSyntax/parser';

const SIZE_UNIT_SUGGESTIONS = ['bytes', 'kib', 'mib', 'gib'] as const;

const DEFAULT_SIZE_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: SIZE_UNIT_SUGGESTIONS.map(unit => ({value: `10${unit}`})),
  },
];

export function getSizeSuggestions(
  inputValue: string,
  token: TokenResult<Token.FILTER>
): SuggestionSection[] {
  if (!inputValue) {
    const currentValue =
      token.value.type === Token.VALUE_DURATION ? token.value.value : null;

    if (!currentValue) {
      return DEFAULT_SIZE_SUGGESTIONS;
    }

    return [
      {
        sectionText: '',
        suggestions: SIZE_UNIT_SUGGESTIONS.map(unit => ({
          value: `${currentValue}${unit}`,
        })),
      },
    ];
  }

  const parsed = parseFilterValueSize(inputValue);

  if (parsed) {
    return [
      {
        sectionText: '',
        suggestions: SIZE_UNIT_SUGGESTIONS.map(unit => ({
          value: `${parsed.value}${unit}`,
        })),
      },
    ];
  }

  // If the value doesn't contain any valid number or duration, don't show any suggestions
  return [];
}
