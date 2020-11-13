export type Item = {
  value: any;
  label: ((value: any) => React.ReactNode) | React.ReactNode;
  index: number;
  searchKey?: string;
  groupLabel?: boolean;
} & Record<string, any>;

type Items<T> = Array<
  T & {
    items?: Array<T>;
    hideGroupLabel?: boolean; // Should hide group label
  }
>;

export type ItemsBeforeFilter = Items<Omit<Item, 'index'>>;

export type ItemsAfterFilter = Items<Item>;

export type GetItemArgs = {item: Item; index: number; style?: React.CSSProperties};
