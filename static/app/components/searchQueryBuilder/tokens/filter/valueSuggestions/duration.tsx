import {parseFilterValueDuration} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/duration/parser';
import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import {Token, type TokenResult} from 'sentry/components/searchSyntax/parser';

const DURATION_UNIT_SUGGESTIONS = ['ms', 's', 'm', 'h'] as const;

const DEFAULT_DURATION_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: DURATION_UNIT_SUGGESTIONS.map(unit => ({value: `10${unit}`})),
  },
];

export function getDurationSuggestions(
  inputValue: string,
  token: TokenResult<Token.FILTER>
): SuggestionSection[] {
  if (!inputValue) {
    const currentValue =
      token.value.type === Token.VALUE_DURATION ? token.value.value : null;

    if (!currentValue) {
      return DEFAULT_DURATION_SUGGESTIONS;
    }

    return [
      {
        sectionText: '',
        suggestions: DURATION_UNIT_SUGGESTIONS.map(unit => ({
          value: `${currentValue}${unit}`,
        })),
      },
    ];
  }

  const parsed = parseFilterValueDuration(inputValue);

  if (parsed) {
    return [
      {
        sectionText: '',
        suggestions: DURATION_UNIT_SUGGESTIONS.map(unit => ({
          value: `${parsed.value}${unit}`,
        })),
      },
    ];
  }

  // If the value doesn't contain any valid number or duration, don't show any suggestions
  return [];
}
