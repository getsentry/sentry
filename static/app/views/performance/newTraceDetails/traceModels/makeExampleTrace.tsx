import {TraceTree} from './traceTree';

// Creates an example trace response that we use to render the loading placeholder
function partialTransaction(
  partial: Partial<TraceTree.Transaction>
): TraceTree.Transaction {
  return {
    start_timestamp: 0,
    timestamp: 0,
    errors: [],
    performance_issues: [],
    parent_span_id: '',
    span_id: '',
    parent_event_id: '',
    project_id: 0,
    sdk_name: '',
    profiler_id: '',
    'transaction.duration': 0,
    'transaction.op': 'loading-transaction',
    'transaction.status': 'loading-status',
    generation: 0,
    project_slug: '',
    event_id: `event_id`,
    transaction: `transaction`,
    children: [],
    ...partial,
  };
}

export function makeExampleTrace(metadata: TraceTree.Metadata): TraceTree {
  const trace: TraceTree.Trace = {
    transactions: [],
    orphan_errors: [],
  };

  function randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  let start = new Date().getTime();

  const root = partialTransaction({
    ...metadata,
    generation: 0,
    start_timestamp: start,
    transaction: 'root transaction',
    timestamp: start + randomBetween(100, 200),
  });

  trace.transactions.push(root);

  for (let i = 0; i < 50; i++) {
    const end = start + randomBetween(100, 200);
    const nest = i > 0 && Math.random() > 0.33;

    if (nest) {
      const parent = root.children[root.children.length - 1]!;
      parent.children.push(
        partialTransaction({
          ...metadata,
          generation: 0,
          start_timestamp: start,
          transaction: `parent transaction ${i}`,
          timestamp: end,
        })
      );
      parent.timestamp = end;
    } else {
      root.children.push(
        partialTransaction({
          ...metadata,
          generation: 0,
          start_timestamp: start,
          transaction: 'loading...',
          ['transaction.op']: 'loading',
          timestamp: end,
        })
      );
    }

    start = end;
  }

  return TraceTree.FromTrace(trace, {meta: null, replay: null});
}
