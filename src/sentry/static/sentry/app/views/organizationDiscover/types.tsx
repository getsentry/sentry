export type Aggregation = [string, string | null, string];

export type Condition = [string, string | null, string | number | boolean | null];

export type Query = {
  org_id?: number;
  projects: number[];
  fields: string[];
  aggregations: Aggregation[];
  conditions?: Condition[];
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

export type Organization = {
  id: string;
  slug: string;
  projects: any[];
  access: string[];
};

export type Project = {
  id: string;
};

export type GlobalSelection = {
  projects: number[];
  environments: string[];
  datetime: {
    start: string;
    end: string;
    period: string;
    utc: boolean;
  };
};
