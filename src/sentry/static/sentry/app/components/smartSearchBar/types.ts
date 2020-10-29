export type ItemType =
  | 'default'
  | 'tag-key'
  | 'tag-value'
  | 'first-release'
  | 'invalid-tag'
  | 'recent-search';

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
};

export type Tag = {
  predefined: boolean;
  key: string;
  desc: string;
  values: string[];
};
