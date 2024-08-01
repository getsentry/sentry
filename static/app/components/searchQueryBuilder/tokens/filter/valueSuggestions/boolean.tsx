import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';

export const DEFAULT_BOOLEAN_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: [{value: 'true'}, {value: 'false'}],
  },
];
