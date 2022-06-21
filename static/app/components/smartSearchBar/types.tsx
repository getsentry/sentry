import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {TokenResult} from '../searchSyntax/parser';

export enum ItemType {
  DEFAULT = 'default',
  TAG_KEY = 'tag-key',
  TAG_VALUE = 'tag-value',
  TAG_OPERATOR = 'tag-operator',
  FIRST_RELEASE = 'first-release',
  INVALID_TAG = 'invalid-tag',
  RECENT_SEARCH = 'recent-search',
  PROPERTY = 'property',
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
  children?: React.ReactNode[];
  desc?: string;
  documentation?: React.ReactNode;
  ignoreMaxSearchItems?: boolean;
  isChild?: boolean;
  isGrouped?: boolean;
  kind?: FieldValueKind;
  title?: string;
  type?: ItemType;
  value?: string;
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
    token: TokenResult<any> | null | undefined,
    filterTokenCount: number
  ) => boolean;
  icon: React.ReactNode;
  shortcutType: ShortcutType;
  text: string;
  hotkeys?: {
    actual: string[] | string;
    display: string[] | string;
  };
};
