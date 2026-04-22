import type {ReactNode} from 'react';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

export interface SuggestionItem {
  value: string;
  description?: ReactNode;
  label?: ReactNode;
}

export interface SuggestionSection {
  sectionText: string;
  suggestions: SuggestionItem[];
}

export interface SuggestionSectionItem {
  items: Array<SelectOptionWithKey<string>>;
  sectionText: string;
}
