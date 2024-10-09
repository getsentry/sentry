import {
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {isParentAutogroupedNode, isSiblingAutogroupedNode} from './../traceGuards';
import {TraceTree} from './traceTree';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replayRecord: null, meta: null};

const singleTransactionTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [],
    }),
  ],
  orphan_errors: [],
});

const siblingAutogroupSpans = [
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
];

const parentAutogroupSpans = [
  makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0001', parent_span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0002', parent_span_id: '0001'}),
];

describe('autogrouping', () => {
  describe('parent autogrouping', () => {
    it('groups parent chain with same op', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        parentAutogroupSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('assigns children to tail node', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        [
          makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
          makeSpan({
            op: 'db',
            description: 'redis',
            span_id: '0001',
            parent_span_id: '0000',
          }),
          makeSpan({
            op: 'db',
            description: 'redis',
            span_id: '0002',
            parent_span_id: '0001',
          }),
          makeSpan({
            op: 'http.request',
            description: 'browser',
            span_id: '0003',
            parent_span_id: '0002',
          }),
        ],
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('autogrouped chain points to tail', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        [
          ...parentAutogroupSpans,
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id: parentAutogroupSpans[parentAutogroupSpans.length - 1].span_id,
          }),
        ],
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('expanding parent autogroup renders head to tail chain', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        parentAutogroupSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      TraceTree.ForEachChild(tree.root, c => {
        if (isParentAutogroupedNode(c)) {
          tree.expand(c, true);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing parent autogroup removes its children', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        parentAutogroupSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      TraceTree.ForEachChild(tree.root, c => {
        if (isParentAutogroupedNode(c)) {
          tree.expand(c, true);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();

      TraceTree.ForEachChild(tree.root, c => {
        if (isParentAutogroupedNode(c)) {
          tree.expand(c, false);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('can expand and collapse', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        [
          makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
          makeSpan({
            op: 'db',
            description: 'redis',
            span_id: '0001',
            parent_span_id: '0000',
          }),
          makeSpan({
            op: 'db',
            description: 'redis',
            span_id: '0002',
            parent_span_id: '0001',
          }),
          makeSpan({
            op: 'http.request',
            description: 'browser',
            span_id: '0003',
            parent_span_id: '0002',
          }),
        ],
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      const initial = tree.build().serialize();

      // Expand autogroup part
      TraceTree.ForEachChild(tree.root, c => {
        if (isParentAutogroupedNode(c)) {
          tree.expand(c, true);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();

      // Collapse autogroup part
      TraceTree.ForEachChild(tree.root, c => {
        if (isParentAutogroupedNode(c)) {
          tree.expand(c, false);
        }
      });

      // Tree should be back to initial state
      expect(tree.build().serialize()).toEqual(initial);
    });

    it('autogroups siblings when they are children of a parent autogroup chain', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        [
          ...parentAutogroupSpans,
          ...[1, 2, 3, 4, 5].map(_i =>
            makeSpan({
              op: 'db',
              description: 'sql',
              start_timestamp: start,
              timestamp: start + 1,
              parent_span_id:
                parentAutogroupSpans[parentAutogroupSpans.length - 1].span_id,
            })
          ),
        ],
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });

  describe('sibling autogrouping', () => {
    it('groups spans with the same op and description', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        siblingAutogroupSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('does not autogroup if count is less 5', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        siblingAutogroupSpans.slice(0, 4),
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('autogroups multiple consecutive groups', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        [
          ...siblingAutogroupSpans,
          ...siblingAutogroupSpans.map(s => ({...s, op: 'mysql'})),
        ],
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('expanding sibling autogroup renders its children', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        siblingAutogroupSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      TraceTree.ForEachChild(tree.root, c => {
        if (isSiblingAutogroupedNode(c)) {
          tree.expand(c, true);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing sibling autogroup removes its children', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      TraceTree.FromSpans(
        tree.root.children[0].children[0],
        siblingAutogroupSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      TraceTree.ForEachChild(tree.root, c => {
        if (isSiblingAutogroupedNode(c)) {
          tree.expand(c, true);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
      TraceTree.ForEachChild(tree.root, c => {
        if (isSiblingAutogroupedNode(c)) {
          tree.expand(c, false);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it.todo(
      'collects errors, performance issues and profiles from sibling autogroup chain'
    );
  });
});
