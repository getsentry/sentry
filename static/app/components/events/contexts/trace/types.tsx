export enum TraceKnownDataType {
  TRACE_ID = 'trace_id',
  SPAN_ID = 'span_id',
  PARENT_SPAN_ID = 'parent_span_id',
  OP_NAME = 'op',
  STATUS = 'status',
  EXCLUSIVE_TIME = 'exclusive_time',
  CLIENT_SAMPLE_RATE = 'client_sample_rate',
  DYNAMIC_SAMPLING_CONTEXT = 'dynamic_sampling_context',
  ORIGIN = 'origin',
  DATA = 'data',
}

export type TraceKnownData = {
  [TraceKnownDataType.TRACE_ID]?: string;
  [TraceKnownDataType.SPAN_ID]?: string;
  [TraceKnownDataType.PARENT_SPAN_ID]?: string;
  [TraceKnownDataType.OP_NAME]?: string;
  [TraceKnownDataType.STATUS]?: string;
  [TraceKnownDataType.EXCLUSIVE_TIME]?: number;
  [TraceKnownDataType.CLIENT_SAMPLE_RATE]?: number;
  [TraceKnownDataType.DYNAMIC_SAMPLING_CONTEXT]?: Record<string, string>;
  [TraceKnownDataType.ORIGIN]?: string;
  [TraceKnownDataType.DATA]?: Record<string, any>;
};
