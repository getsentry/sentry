export type EndpointDataRow = {
  count: number;
  description: string;
  domain: string;
  failure_count: number;
  failure_rate: number;
  group_id: string;
  'p50(exclusive_time)': number;
  'p95(exclusive_time)': number;
  transaction_count: number;
};

export type SpanTransactionDataRow = {
  count: number;
  transaction: string;
};
