import type {Organization} from 'sentry/types/organization';

import {TraceTree} from './traceTree';

const EXAMPLE_SPAN_COUNT = 20;

// Creates an example trace response that we use to render the loading placeholder
export function makeExampleTrace(organization: Organization): TraceTree {
  let start = Date.now() / 1e3;

  const root = partialEAPSpan({
    event_id: 'example-span-0',
    start_timestamp: start,
    end_timestamp: start + randomBetween(100, 200) / 1e3,
    name: 'root span',
  });

  const trace: TraceTree.EAPTrace = [root];

  for (let i = 1; i <= EXAMPLE_SPAN_COUNT; i++) {
    const end = start + randomBetween(100, 200) / 1e3;
    // The first child has to attach to the root, otherwise there is no previous
    // sibling to nest under.
    const nest = i > 1 && Math.random() > 0.33;
    const parent = nest ? root.children[root.children.length - 1]! : root;

    parent.children.push(
      partialEAPSpan({
        event_id: `example-span-${i}`,
        parent_span_id: parent.event_id,
        start_timestamp: start,
        end_timestamp: end,
        name: nest ? `nested span ${i}` : 'loading...',
      })
    );

    // Grow the ancestors so they contain their children
    parent.end_timestamp = Math.max(parent.end_timestamp, end);
    parent.duration = (parent.end_timestamp - parent.start_timestamp) * 1e3;
    root.end_timestamp = Math.max(root.end_timestamp, end);
    root.duration = (root.end_timestamp - root.start_timestamp) * 1e3;

    start = end;
  }

  return TraceTree.FromTrace(trace, {meta: null, replay: null, organization});
}

function partialEAPSpan(
  partial: Partial<TraceTree.EAPSpan> &
    Pick<TraceTree.EAPSpan, 'event_id' | 'start_timestamp' | 'end_timestamp'>
): TraceTree.EAPSpan {
  return {
    children: [],
    duration: (partial.end_timestamp - partial.start_timestamp) * 1e3,
    errors: [],
    event_type: 'span',
    // Spans render collapsed when they are transactions, which would hide the
    // rest of the placeholder rows
    is_transaction: false,
    name: 'loading...',
    occurrences: [],
    op: 'loading',
    parent_span_id: null,
    profile_id: '',
    profiler_id: '',
    project_id: 0,
    project_slug: '',
    sdk_name: '',
    transaction: 'transaction',
    transaction_id: '',
    ...partial,
  };
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
