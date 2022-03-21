export type ExampleSpan = {
  exclusiveTime: number;
  finishTimestamp: number;
  id: string;
  startTimestamp: number;
};

export type ExampleTransaction = {
  description: string | null;
  finishTimestamp: number;
  id: string;
  nonOverlappingExclusiveTime: number;
  spans: ExampleSpan[];
  startTimestamp: number;
};

export type SpanExample = {
  description: string | null;
  examples: ExampleTransaction[];
  group: string;
  op: string;
};

export type SuspectSpan = SpanExample & {
  avgOccurrences?: number;
  count?: number;
  frequency?: number;
  p50ExclusiveTime?: number;
  p75ExclusiveTime?: number;
  p95ExclusiveTime?: number;
  p99ExclusiveTime?: number;
  sumExclusiveTime?: number;
};

export type SuspectSpans = SuspectSpan[];

export type SpanOp = {
  op: string;
};

export type SpanOps = SpanOp[];

export type SpanSlug = {
  group: string;
  op: string;
};
