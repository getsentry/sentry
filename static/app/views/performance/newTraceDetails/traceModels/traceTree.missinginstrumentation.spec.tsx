import {OrganizationFixture} from 'sentry-fixture/organization';

import {isMissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceTree} from './traceTree';

const organization = OrganizationFixture();

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replay: null, meta: null, organization};

const eapMissingInstrumentationSpans = [
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    end_timestamp: start + 1,
  }),
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start + 2,
    end_timestamp: start + 4,
  }),
];

const eapChildrenMissingInstrumentationSpans = [
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    event_id: 'redis',
    start_timestamp: start,
    end_timestamp: start + 1,
    children: [
      makeEAPSpan({
        op: 'http',
        description: 'request',
        event_id: 'other redis',
        parent_span_id: 'redis',
        start_timestamp: start + 2,
        end_timestamp: start + 4,
      }),
    ],
  }),
];

describe('missing instrumentation', () => {
  describe('eap traces', () => {
    it('adds missing instrumentation between sibling eap spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(eapMissingInstrumentationSpans),
        traceMetadata
      );

      TraceTree.DetectMissingInstrumentation(tree.root);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('adds missing instrumentation between eap children spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(eapChildrenMissingInstrumentationSpans),
        traceMetadata
      );

      TraceTree.DetectMissingInstrumentation(tree.root);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes missing instrumentation nodes', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace(eapMissingInstrumentationSpans),
        traceMetadata
      );

      const snapshot = tree.build().serialize();

      TraceTree.DetectMissingInstrumentation(tree.root);

      // Assert that missing instrumentation nodes exist
      expect(tree.root.findChild(c => isMissingInstrumentationNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveMissingInstrumentationNodes(tree.root);

      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
