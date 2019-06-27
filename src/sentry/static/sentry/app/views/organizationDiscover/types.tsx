export type AggregationData = [string | null, string | null, string];

export type ConditionData = [
  string | null,
  string | null,
  string | number | boolean | null
];

export type Query = {
  projects?: number[];
  fields: string[];
  aggregations: AggregationData[];
  conditions?: ConditionData[];
  orderby?: string;
  limit?: number;
  range?: string;
  start?: string;
  end?: string;
};

export type SavedQuery = Query & {
  id: string;
  name: string;
  dateCreated: string;
  dateUpdated: string;
  createdBy?: string;
};

export type Result = {
  data: SnubaResult;
  query: Query;
  current: any;
  next?: any;
  prev?: any;
};

export type SnubaResult = {
  data: any[];
  meta: {name: string; type: string}[];
  timing: any;
  error?: any;
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
