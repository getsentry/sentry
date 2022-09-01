import {FieldKind} from 'sentry/utils/fields';

import {Token, TokenResult} from '../searchSyntax/parser';

export enum ItemType {
  DEFAULT = 'default',
  TAG_KEY = 'tag-key',
  TAG_VALUE = 'tag-value',
  TAG_VALUE_ISO_DATE = 'tag-value-iso-date',
  TAG_OPERATOR = 'tag-operator',
  FIRST_RELEASE = 'first-release',
  INVALID_TAG = 'invalid-tag',
  RECENT_SEARCH = 'recent-search',
  PROPERTY = 'property',
  LINK = 'link',
}

export type SearchGroup = {
  children: SearchItem[];
  icon: React.ReactNode;
  title: string;
  type: ItemType | 'header';
  desc?: string;
  value?: string;
};

export type SearchItem = {
  active?: boolean;
  /**
   * Call a callback instead of setting a value in the search query
   */
  callback?: () => void;
  /**
   * Child search items, we only support 1 level of nesting though.
   */
  children?: SearchItem[];
  deprecated?: boolean;
  desc?: string;
  documentation?: React.ReactNode;
  /**
   * The feature flag gating the search item
   */
  featureFlag?: string;
  ignoreMaxSearchItems?: boolean;
  kind?: FieldKind;
  title?: string;
  type?: ItemType;
  /**
   * A value of null means that this item is not selectable in the search dropdown
   */
  value?: string | null;
};

export type Tag = {
  desc: string;
  key: string;
  predefined: boolean;
  values: string[];
};

export enum ShortcutType {
  Delete = 'delete',
  Negate = 'negate',
  Next = 'next',
  Previous = 'previous',
}

export type Shortcut = {
  canRunShortcut: (
    token: TokenResult<Token> | null | undefined,
    filterTokenCount: number
  ) => boolean;
  icon: React.ReactNode;
  shortcutType: ShortcutType;
  text: string;
  hotkeys?: {
    actual: string[] | string;
    display?: string[] | string;
  };
};

export type AutocompleteGroup = {
  recentSearchItems: SearchItem[] | undefined;
  searchItems: SearchItem[];
  tagName: string;
  type: ItemType;
};
