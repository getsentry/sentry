export type AggregationData = [
  string | null,
  string | null,
  string | number | boolean | null
];

export type ConditionData = [
  string | null,
  string | null,
  string | number | boolean | null
];

export type Query = {
  projects?: number[];
  fields?: string[];
  aggregations?: AggregationData[];
  conditions?: ConditionData[];
  orderby?: string;
  limit?: number;
};

export type SnubaResult = {
  data: any[];
  meta: any;
};

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

export type Organization = {
  id: string;
  slug: string;
  projects: any[];
  access: string[];
};

export type Project = {
  id: string;
};
