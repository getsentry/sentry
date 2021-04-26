export type MetricQuery = {
  legend: string;
  aggregation: string;
  groupBy: string[];
  tags?: string;
};

export type Metric = {
  name: string;
  type: string;
  operations: string[];
  tags: string[];
  unit: string | null;
};

export type MetricWidget = {
  title: string;
  queries: MetricQuery[];
  yAxis?: string;
  id?: string;
};
