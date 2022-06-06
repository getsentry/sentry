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
  children?: React.ReactNode[];
  desc?: string;
  documentation?: React.ReactNode;
  ignoreMaxSearchItems?: boolean;
  onClick?: () => void;
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

export enum TokenActionType {
  Delete = 'delete',
  Negate = 'negate',
}

export type TokenAction = {
  token: TokenResult<Token.Filter>;
  type: TokenActionType;
};

export type SelectFilterTokenParams = {
  filterToken: TokenResult<Token.Filter>;
  filterTokenRef: React.RefObject<HTMLSpanElement>;
  isClick?: boolean;
};

export const commonActions = [
  {
    text: 'Delete',
    actionType: TokenActionType.Delete,
    hotkeys: {
      actual: 'option+backspace',
      display: 'option+backspace',
    },
  },
  {
    text: 'Negate',
    actionType: TokenActionType.Negate,
    hotkeys: {
      actual: ['option+1', 'cmd+1'],
      display: 'option+!',
    },
  },
];
