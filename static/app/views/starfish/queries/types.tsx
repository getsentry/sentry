export type IndexedSpan = {
  action: string;
  description: string;
  domain: string;
  group: string;
  module: string;
  'span.op': string;
  'span.self_time': number;
  span_id: string;
  timestamp: string;
  transaction_id: string;
};
