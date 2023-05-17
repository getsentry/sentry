export type Span = {
  group_id: string;
  span_operation: string;
  action?: string;
  description?: string;
  domain?: string;
  formatted_desc?: string;
};

export type SpanMetrics = {
  first_seen: string;
  last_seen: string;
  total_time: number;
};
