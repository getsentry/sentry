export type Item = {
  index: number;
  label: ((value: any) => React.ReactNode) | React.ReactNode;
  value: any;
  'data-test-id'?: string;
  disabled?: boolean;
  /**
   * Error message to display for the field
   */
  error?: React.ReactNode;
  groupLabel?: boolean;
  searchKey?: string;
} & Record<string, any>;

type Items<T> = Array<
  T & {
    hideGroupLabel?: boolean;
    items?: Array<T>; // Should hide group label
  }
>;

export type ItemsBeforeFilter = Items<Omit<Item, 'index'>>;

export type ItemsAfterFilter = Items<Item>;
