export type Item = {
  value: any;
  label: ((value: any) => React.ReactNode) | React.ReactNode;
  index: number;
  searchKey?: string;
  groupLabel?: boolean;
} & Record<string, any>;

export type GetItemArgs = {item: Item; index: number; style?: React.CSSProperties};
