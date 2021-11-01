export type ExampleSpan = {
  id: string;
  startTimestamp: number;
  finishTimestamp: number;
  exclusiveTime: number;
};

export type ExampleTransaction = {
  id: string;
  description: string | null;
  startTimestamp: number;
  finishTimestamp: number;
  nonOverlappingExclusiveTime: number;
  spans: ExampleSpan[];
};

export type SuspectSpan = {
  projectId: number;
  project: string;
  transaction: string;
  op: string;
  group: string;
  frequency: number;
  count: number;
  sumExclusiveTime: number;
  p50ExclusiveTime: number;
  p75ExclusiveTime: number;
  p95ExclusiveTime: number;
  p99ExclusiveTime: number;
  examples: ExampleTransaction[];
};

export type SuspectSpans = SuspectSpan[];

export type SpanOp = {
  op: string;
};

export type SpanOps = SpanOp[];
