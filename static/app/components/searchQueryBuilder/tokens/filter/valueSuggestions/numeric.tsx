import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';

const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;
const NUMERIC_UNITS = ['k', 'm', 'b'] as const;
const DEFAULT_NUMERIC_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: [{value: '100'}, {value: '100k'}, {value: '100m'}, {value: '100b'}],
  },
];

function isNumeric(value: string) {
  return NUMERIC_REGEX.test(value);
}

export function getNumericSuggestions(inputValue: string): SuggestionSection[] {
  if (!inputValue) {
    return DEFAULT_NUMERIC_SUGGESTIONS;
  }

  if (isNumeric(inputValue)) {
    return [
      {
        sectionText: '',
        suggestions: NUMERIC_UNITS.map(unit => ({
          value: `${inputValue}${unit}`,
        })),
      },
    ];
  }

  // If the value is not numeric, don't show any suggestions
  return [];
}
