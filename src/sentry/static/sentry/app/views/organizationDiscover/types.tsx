export type SnubaResult = [
  string | null,
  string | null,
  string | number | boolean | null
];

export type Column = {
  name: string;
  type: string;
  isTag?: boolean;
};

export type ReactSelectState = {
  inputValue: string;
  isOpen: boolean;
};

export type ReactSelectValue = {
  label: string;
  value: string;
};

export type DiscoverBaseProps = {
  columns: Column[];
  disabled: boolean;
};
