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
  desc: string;
  value: string;
  active?: boolean;
  children?: React.ReactNode[];
  documentation?: React.ReactNode;
  ignoreMaxSearchItems?: boolean;
  title?: string;
  type?: ItemType;
};

export type Tag = {
  desc: string;
  key: string;
  predefined: boolean;
  values: string[];
};
