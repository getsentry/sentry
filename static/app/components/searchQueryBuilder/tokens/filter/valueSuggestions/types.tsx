import type {ReactNode} from 'react';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import type {Tag} from 'sentry/types/group';

export type SuggestionItem = {
  value: string;
  description?: ReactNode;
  label?: ReactNode;
  tag?: Tag;
};

export type SuggestionSection = {
  sectionText: string;
  suggestions: SuggestionItem[];
};

export type SuggestionSectionItem = {
  items: Array<SelectOptionWithKey<string>>;
  sectionText: string;
};
