import type {ReactNode} from 'react';

import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';

export type SuggestionItem = {
  value: string;
  description?: ReactNode;
  label?: ReactNode;
};

export type SuggestionSection = {
  sectionText: string;
  suggestions: SuggestionItem[];
};

export type SuggestionSectionItem = {
  items: Array<SelectOptionWithKey<string>>;
  sectionText: string;
};
