export type Item = {
  value: any;
  label: ((value: any) => React.ReactNode) | React.ReactNode;
  index: number;
  disabled?: boolean;
  searchKey?: string;
  groupLabel?: boolean;
  /**
   * Error message to display for the field
   */
  error?: React.ReactNode;
  'data-test-id'?: string;
} & Record<string, any>;

type Items<T> = Array<
  T & {
    items?: Array<T>;
    hideGroupLabel?: boolean; // Should hide group label
  }
>;

export type ItemsBeforeFilter = Items<Omit<Item, 'index'>>;

export type ItemsAfterFilter = Items<Item>;
