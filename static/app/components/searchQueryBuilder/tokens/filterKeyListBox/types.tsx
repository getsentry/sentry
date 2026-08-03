import type {ReactNode} from 'react';

import type {
  SelectOptionWithKey,
  SelectSectionWithKey,
} from '@sentry/scraps/compactSelect';

import type {Tag} from 'sentry/types/group';

export interface KeyItem extends SelectOptionWithKey<string> {
  description: string;
  hideCheck: boolean;
  showDetailsInOverlay: boolean;
  tag: Tag;
  textValue: string;
  type: 'item';
  value: string;
}

export interface KeySectionItem extends SelectSectionWithKey<string> {
  options: SearchKeyItem[];
  type: 'section';
  value: string;
}

export interface RawSearchItem extends SelectOptionWithKey<string> {
  type: 'raw-search';
  value: string;
}

export interface FilterValueItem extends SelectOptionWithKey<string> {
  type: 'filter-value';
  value: string;
}

export interface RawSearchFilterIsValueItem extends SelectOptionWithKey<string> {
  type: 'raw-search-filter-is-value';
  value: string;
}

interface RecentFilterItem extends SelectOptionWithKey<string> {
  type: 'recent-filter';
  value: string;
}

export interface RecentQueryItem extends SelectOptionWithKey<string> {
  hideCheck: boolean;
  type: 'recent-query';
  value: string;
}

/**
 * A suggestion that converts "humanized ESQ" the user typed (e.g. "is unresolved
 * assigned is me") into real ESQ ("is:unresolved assigned:me").
 */
export interface ConvertHumanizedItem extends SelectOptionWithKey<string> {
  hideCheck: boolean;
  type: 'convert-humanized';
  value: string;
}

export interface AskSeerItem extends SelectOptionWithKey<string> {
  hideCheck: boolean;
  type: 'ask-seer';
  value: string;
}

interface AskSeerConsentItem extends SelectOptionWithKey<string> {
  type: 'ask-seer-consent';
  value: string;
}

export interface LogicFilterItem extends SelectOptionWithKey<string> {
  type: 'logic-filter';
  value: 'AND' | 'OR' | '(' | ')';
}

export type SearchKeyItem =
  | KeySectionItem
  | KeyItem
  | RawSearchItem
  | FilterValueItem
  | RawSearchFilterIsValueItem
  | AskSeerItem
  | AskSeerConsentItem
  | LogicFilterItem;

export type FilterKeyItem =
  | KeyItem
  | RecentFilterItem
  | KeySectionItem
  | RecentQueryItem
  | ConvertHumanizedItem
  | RawSearchItem
  | FilterValueItem
  | RawSearchFilterIsValueItem
  | AskSeerItem
  | AskSeerConsentItem
  | LogicFilterItem;

export type Section = {
  label: ReactNode;
  value: string;
};
