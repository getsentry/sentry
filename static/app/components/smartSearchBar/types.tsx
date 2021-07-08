export enum ItemType {
  DEFAULT = 'default',
  TAG_KEY = 'tag-key',
  TAG_VALUE = 'tag-value',
  TAG_OPERATOR = 'tag-operator',
  FIRST_RELEASE = 'first-release',
  INVALID_TAG = 'invalid-tag',
  RECENT_SEARCH = 'recent-search',
}

export type SearchGroup = {
  type: ItemType | 'header';
  title: string;
  icon: React.ReactNode;
  value?: string;
  desc?: string;
  children: SearchItem[];
};

export type SearchItem = {
  type?: ItemType;
  title?: string;
  value: string;
  desc: string;
  active?: boolean;
  children?: React.ReactNode[];
  ignoreMaxSearchItems?: boolean;
};

export type Tag = {
  predefined: boolean;
  key: string;
  desc: string;
  values: string[];
};
