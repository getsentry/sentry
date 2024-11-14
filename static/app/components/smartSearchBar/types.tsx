import type {FieldKind} from 'sentry/utils/fields';

import type {Token, TokenResult} from '../searchSyntax/parser';

export enum ItemType {
  DEFAULT = 'default',
  TAG_KEY = 'tag-key',
  TAG_VALUE = 'tag-value',
  TAG_VALUE_ISO_DATE = 'tag-value-iso-date',
  TAG_OPERATOR = 'tag-operator',
  FIRST_RELEASE = 'first-release',
  INVALID_TAG = 'invalid-tag',
  INVALID_QUERY_WITH_WILDCARD = 'invalid-tag-with-wildcard',
  RECENT_SEARCH = 'recent-search',
  PROPERTY = 'property',
  LINK = 'link',
  RECOMMENDED = 'recommended',
}

export const invalidTypes = [ItemType.INVALID_TAG, ItemType.INVALID_QUERY_WITH_WILDCARD];

export type SearchGroup = {
  children: SearchItem[];
  icon: React.ReactNode;
  title: string;
  type: ItemType | 'header';
  /**
   * A wrapper around the children, useful for adding a custom layout
   */
  childrenWrapper?: React.FC<{children: React.ReactNode}>;
  desc?: string;
  documentation?: React.ReactNode;
  value?: string;
};

export type SearchItem = {
  active?: boolean;
  /**
   * When this item is selected, apply a filter to the search query
   */
  applyFilter?: (item: SearchItem) => void;
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
  titleBadge?: React.ReactNode;
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
  DELETE = 'delete',
  NEGATE = 'negate',
  NEXT = 'next',
  PREVIOUS = 'previous',
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
  searchItems: SearchItem[] | SearchGroup[];
  tagName: string;
  type: ItemType;
};
