export enum TraceKnownDataType {
  TRACE_ID = 'trace_id',
  SPAN_ID = 'span_id',
  PARENT_SPAN_ID = 'parent_span_id',
  OP_NAME = 'op',
  STATUS = 'status',
  TRANSACTION_NAME = 'transaction_name',
}

export type TraceKnownData = {
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  op?: string;
  status?: string;
};
