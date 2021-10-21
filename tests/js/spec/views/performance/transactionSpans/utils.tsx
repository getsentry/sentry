import {
  ExampleSpan,
  ExampleTransaction,
  SuspectSpan,
} from 'app/utils/performance/suspectSpans/types';

type SpanOpt = {
  id: string;
};

type ExampleOpt = {
  id: string;
  description: string;
  spans: SpanOpt[];
};

type SuspectOpt = {
  op: string;
  group: string;
  examples: ExampleOpt[];
};

function makeSpan(opt: SpanOpt): ExampleSpan {
  const {id} = opt;
  return {
    id,
    startTimestamp: 10100,
    finishTimestamp: 10200,
    exclusiveTime: 100,
  };
}

function makeExample(opt: ExampleOpt): ExampleTransaction {
  const {id, description, spans} = opt;
  return {
    id,
    description,
    startTimestamp: 10000,
    finishTimestamp: 12000,
    nonOverlappingExclusiveTime: 2000,
    spans: spans.map(makeSpan),
  };
}

export function makeSuspectSpan(opt: SuspectOpt): SuspectSpan {
  const {op, group, examples} = opt;
  return {
    projectId: 1,
    project: 'bar',
    transaction: 'transaction-1',
    op,
    group,
    frequency: 1,
    count: 1,
    sumExclusiveTime: 1,
    p50ExclusiveTime: 1,
    p75ExclusiveTime: 1,
    p95ExclusiveTime: 1,
    p99ExclusiveTime: 1,
    examples: examples.map(makeExample),
  };
}
