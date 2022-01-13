export interface ExampleSpan {
  id: string;
  startTimestamp: number;
  finishTimestamp: number;
  exclusiveTime: number;
}

export interface ExampleTransaction {
  id: string;
  description: string | null;
  startTimestamp: number;
  finishTimestamp: number;
  nonOverlappingExclusiveTime: number;
  spans: ExampleSpan[];
}

export interface SpanExample {
  op: string;
  group: string;
  examples: ExampleTransaction[];
}

export interface SuspectSpan extends SpanExample {
  projectId: number;
  project: string;
  transaction: string;
  frequency?: number;
  count?: number;
  avgOccurrences?: number;
  sumExclusiveTime?: number;
  p50ExclusiveTime?: number;
  p75ExclusiveTime?: number;
  p95ExclusiveTime?: number;
  p99ExclusiveTime?: number;
}

export type SuspectSpans = SuspectSpan[];

export interface SpanOp {
  op: string;
}

export type SpanOps = SpanOp[];
