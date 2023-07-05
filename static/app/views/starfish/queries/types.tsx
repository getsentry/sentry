export type Span = {
  group_id: string;
  span_operation: string;
  action?: string;
  description?: string;
  domain?: string;
  formatted_desc?: string;
  span_id?: string;
};

export type IndexedSpan = {
  action: string;
  description: string;
  domain: string;
  group: string;
  module: string;
  op: string;
  'span.self_time': number;
  span_id: string;
  timestamp: string;
  transaction_id: string;
};
