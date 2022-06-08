import {Token, TokenResult} from '../searchSyntax/parser';

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

export enum QuickActionType {
  Delete = 'delete',
  Negate = 'negate',
  Next = 'next',
  Previous = 'previous',
}

export type QuickAction = {
  actionType: QuickActionType;
  text: string;
  canRunAction?: (
    token: TokenResult<any> | undefined,
    filterTokenCount: number
  ) => boolean;
  hotkeys?: {
    actual: string[] | string;
    display: string[] | string;
  };
};

export const commonActions: QuickAction[] = [
  {
    text: 'Delete',
    actionType: QuickActionType.Delete,
    hotkeys: {
      actual: 'option+backspace',
      display: 'option+backspace',
    },
    canRunAction: t => {
      return t?.type === Token.Filter;
    },
  },
  {
    text: 'Negate',
    actionType: QuickActionType.Negate,
    hotkeys: {
      actual: ['option+1', 'cmd+1'],
      display: 'option+!',
    },
    canRunAction: t => {
      return t?.type === Token.Filter;
    },
  },
  {
    text: 'Previous Token',
    actionType: QuickActionType.Previous,
    hotkeys: {
      actual: ['option+left'],
      display: 'option+left',
    },
    canRunAction: (t, count) => {
      return count > 1 || t?.type !== Token.Filter;
    },
  },
  {
    text: 'Next Token',
    actionType: QuickActionType.Next,
    hotkeys: {
      actual: ['option+right'],
      display: 'option+right',
    },
    canRunAction: (t, count) => {
      return count > 1 || t?.type !== Token.Filter;
    },
  },
];
