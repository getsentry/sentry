import type {ReactNode} from 'react';

import type {
  SelectOptionWithKey,
  SelectSectionWithKey,
} from 'sentry/components/compactSelect/types';

export interface KeyItem extends SelectOptionWithKey<string> {
  description: string;
  details: React.ReactNode;
  hideCheck: boolean;
  showDetailsInOverlay: boolean;
  textValue: string;
  type: 'item';
  value: string;
}

export interface KeySectionItem extends SelectSectionWithKey<string> {
  options: KeyItem[];
  type: 'section';
  value: string;
}

export interface RecentFilterItem extends SelectOptionWithKey<string> {
  type: 'recent-filter';
  value: string;
}

export interface RecentQueryItem extends SelectOptionWithKey<string> {
  hideCheck: boolean;
  type: 'recent-query';
  value: string;
}

export type FilterKeyItem = KeyItem | RecentFilterItem | KeySectionItem | RecentQueryItem;

export type Section = {
  label: ReactNode;
  value: string;
};
