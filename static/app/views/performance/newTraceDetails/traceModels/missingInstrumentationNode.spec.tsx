import {
  makeNodeMetadata,
  makeSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceTreeNode} from '../traceModels/traceTreeNode';

import {MissingInstrumentationNode} from './missingInstrumentationNode';

describe('MissingInstrumentationNode', () => {
  it('stores references to previous and next spans', () => {
    const previous = new TraceTreeNode(null, makeSpan(), makeNodeMetadata());
    const current = new TraceTreeNode(null, makeSpan(), makeNodeMetadata());

    const node = new MissingInstrumentationNode(
      new TraceTreeNode(null, makeSpan(), makeNodeMetadata()),
      {
        type: 'missing_instrumentation',
        start_timestamp: previous.value.timestamp,
        timestamp: current.value.start_timestamp,
      },
      makeNodeMetadata(),
      previous,
      current
    );

    expect(node.previous).toBe(previous);
    expect(node.next).toBe(current);
  });
});
