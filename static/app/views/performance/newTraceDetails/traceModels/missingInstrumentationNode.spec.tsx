import {
  makeNodeMetadata,
  makeSpan,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceTreeNode} from '../traceModels/traceTreeNode';

import {
  MissingInstrumentationNode,
  shouldInsertMissingInstrumentationSpan,
} from './missingInstrumentationNode';

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

  describe('shouldInsertMissingInstrumentationSpan', () => {
    it('false if previous is not a span', () => {
      const previous = new TraceTreeNode(null, makeTransaction(), makeNodeMetadata());
      const current = new TraceTreeNode(null, makeSpan(), makeNodeMetadata());

      expect(shouldInsertMissingInstrumentationSpan(previous, current)).toBe(false);
    });
    it('false if next is not a span', () => {
      const previous = new TraceTreeNode(null, makeSpan(), makeNodeMetadata());
      const current = new TraceTreeNode(null, makeTransaction(), makeNodeMetadata());

      expect(shouldInsertMissingInstrumentationSpan(previous, current)).toBe(false);
    });
    it('false if gap is too small', () => {
      const previous = new TraceTreeNode(
        null,
        makeSpan({start_timestamp: 0, timestamp: 1}),
        makeNodeMetadata()
      );
      const current = new TraceTreeNode(
        null,
        makeSpan({start_timestamp: 1.01, timestamp: 2}),
        makeNodeMetadata()
      );

      expect(shouldInsertMissingInstrumentationSpan(previous, current)).toBe(false);
    });
    it('true if gap is sufficiently large', () => {
      const previous = new TraceTreeNode(
        null,
        makeSpan({start_timestamp: 0, timestamp: 1}),
        makeNodeMetadata()
      );
      const current = new TraceTreeNode(
        null,
        makeSpan({start_timestamp: 1.2, timestamp: 2}),
        makeNodeMetadata()
      );
      expect(shouldInsertMissingInstrumentationSpan(previous, current)).toBe(true);
    });
  });
});
