export type Span = {
  group_id: string;
  action?: string;
  description?: string;
  domain?: string;
};

export type SpanMetrics = {
  first_seen: string;
  last_seen: string;
  total_time: number;
};
