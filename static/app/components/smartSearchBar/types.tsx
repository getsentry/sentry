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

export interface SearchGroup {
  type: ItemType | 'header';
  title: string;
  icon: React.ReactNode;
  value?: string;
  desc?: string;
  children: SearchItem[];
}

export interface SearchItem {
  type?: ItemType;
  title?: string;
  value: string;
  desc: string;
  active?: boolean;
  children?: React.ReactNode[];
  ignoreMaxSearchItems?: boolean;
}

export interface Tag {
  predefined: boolean;
  key: string;
  desc: string;
  values: string[];
}
