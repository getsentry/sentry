export type Aggregation = [string, string | null, string];

export type Condition = [string, string | null, string | number | boolean | null];

export type Query = {
  projects: number[];
  fields: string[];
  aggregations: Aggregation[];
  conditions?: Condition[];
  version?: number;
  query?: string;
  orderby?: string;
  groupby?: string;
  rollup?: number;
  name?: string;
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
  current: string;
  next?: string;
  prev?: string;
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

export type ReactSelectOption = {
  label: string;
  value: string;
  isTag?: boolean;
};

export type DiscoverBaseProps = {
  columns: Column[];
  disabled: boolean;
};
