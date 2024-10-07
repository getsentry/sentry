import {
  makeEventTransaction,
  makeSpan,
  makeTrace,
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isTransactionNode,
} from './../traceGuards';
import {TraceTree} from './traceTree';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const end = new Date('2024-02-29T00:00:00Z').getTime() / 1e3 + 5;

const traceMetadata = {replayRecord: null, meta: null};

const trace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [makeTransaction({start_timestamp: start + 1, timestamp: start + 4})],
    }),
  ],
  orphan_errors: [],
});

const ssrTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      ['transaction.op']: 'http.server',
      children: [
        makeTransaction({
          start_timestamp: start,
          timestamp: start + 2,
          ['transaction.op']: 'pageload',
          children: [],
        }),
      ],
    }),
  ],
});

const ssrSpans = [
  makeSpan({
    op: 'tls.connect',
    start_timestamp: start,
    timestamp: start + 2,
  }),
  makeSpan({
    op: 'browser.request',
    description: 'browser',
    start_timestamp: start,
    timestamp: start + 2,
  }),
];

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

const traceWithOrphanError = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [makeTransaction({start_timestamp: start + 1, timestamp: start + 2})],
    }),
  ],
  orphan_errors: [makeTraceError({level: 'error', timestamp: end})],
});

const outOfOrderTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: 1,
      transaction: 'last',
      children: [],
    }),
    makeTransaction({start_timestamp: 0, transaction: 'first'}),
  ],
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

const missingInstrumentationSpans = [
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'db',
    description: 'redis',
    start_timestamp: start + 2,
    timestamp: start + 4,
  }),
];

const childrenMissingInstrumentationSpans = [
  makeSpan({
    op: 'db',
    description: 'redis',
    span_id: 'redis',
    start_timestamp: start,
    timestamp: start + 1,
  }),
  makeSpan({
    op: 'http',
    description: 'request',
    span_id: 'other redis',
    parent_span_id: 'redis',
    start_timestamp: start + 2,
    timestamp: start + 4,
  }),
];

describe('TraceTree', () => {
  it('assembles tree from trace', () => {
    const tree = TraceTree.FromTrace(trace, traceMetadata);
    expect(tree.serialize()).toMatchSnapshot();
  });

  it('sorts by start_timestamp', () => {
    const tree = TraceTree.FromTrace(outOfOrderTrace, traceMetadata);
    expect(tree.serialize()).toMatchSnapshot();
  });

  it('inserts orphan error', () => {
    const tree = TraceTree.FromTrace(traceWithOrphanError, {
      meta: null,
      replayRecord: null,
    });
    expect(tree.serialize()).toMatchSnapshot();
  });

  describe('aggreagate node events', () => {
    it('adds errors to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              errors: [makeTraceError()],
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0].errors.size).toBe(1);
    });

    it('stores trace error as error on node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          orphan_errors: [makeTraceError()],
        }),
        traceMetadata
      );
      expect(tree.root.children[0].children[0].errors.size).toBe(1);
    });

    it('adds performance issues to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              performance_issues: [makeTracePerformanceIssue()],
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0].children[0].performance_issues.size).toBe(1);
    });

    it('adds transaction profile to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              profile_id: 'profile-id',
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0].children[0].profiles.length).toBe(1);
    });

    it('adds continuous profile to node', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              profiler_id: 'profile-id',
              children: [],
            }),
          ],
        }),
        traceMetadata
      );
      expect(tree.root.children[0].children[0].profiles.length).toBe(1);
    });

    it.todo('errors extend trace start and end');
    it.todo('performance issues extend trace start and end');
  });

  describe('trace start and end', () => {
    it('infered from min(events.start_timestamp)', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      expect(tree.root.space[0]).toBe(trace.transactions[0].start_timestamp * 1e3);
    });

    it('infered from max(events.timestamp)', () => {
      const tree = TraceTree.FromTrace(trace, traceMetadata);
      expect(tree.root.space[1]).toBe(4000);
    });

    it('end,0 we cannot construct a timeline', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({orphan_errors: [makeTraceError({level: 'error', timestamp: end})]}),
        traceMetadata
      );

      expect(tree.root.space[0]).toBe(end * 1e3);
      expect(tree.root.space[1]).toBe(0);
    });

    it('considers all children when inferring start and end', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: start,
              timestamp: start + 1,
              children: [],
            }),
            makeTransaction({
              start_timestamp: start - 1,
              timestamp: start + 2,
              children: [],
            }),
          ],
          orphan_errors: [],
        }),
        traceMetadata
      );
      expect(tree.root.space[1]).toBe(3000);
      expect(tree.root.space[0]).toBe(start * 1e3 - 1e3);
    });

    it('replay record extends trace start', () => {
      const replayStart = new Date('2024-02-29T00:00:00Z').getTime();
      const replayEnd = new Date(replayStart + 5000).getTime();

      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              start_timestamp: replayStart / 1e3 + 0.1,
              timestamp: replayStart / 1e3 + 0.1,
            }),
          ],
        }),
        {
          meta: null,
          replayRecord: {
            started_at: new Date(replayStart),
            finished_at: new Date(replayEnd),
          } as ReplayRecord,
        }
      );

      expect(tree.root.space[0]).toBe(replayStart);
      expect(tree.root.space[1]).toBe(5000);
    });
  });

  describe('ForEachChild', () => {
    it('iterates dfs', () => {
      const tree = TraceTree.FromTrace(
        makeTrace({
          transactions: [
            makeTransaction({
              transaction: 'root',
              children: [
                makeTransaction({transaction: 'child'}),
                makeTransaction({transaction: 'other_child'}),
              ],
            }),
          ],
        }),
        {meta: null, replayRecord: null}
      );

      const visitedNodes: string[] = [];
      TraceTree.ForEachChild(tree.root, node => {
        if (isTransactionNode(node)) {
          visitedNodes.push(node.value.transaction);
        }
      });

      expect(visitedNodes).toEqual(['root', 'child', 'other_child']);
    });
  });

  describe('FromTrace', () => {
    it.todo('places spans under parents');
    it.todo('reparents transactions under spans');
    it.todo('transaction under okhttp span is visible');
    it.todo('ssr');
  });

  describe('missing instrumentation', () => {
    it('adds missing instrumentation between sibling spans', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      const _spans = TraceTree.FromSpans(
        tree.root.children[0].children[0],
        missingInstrumentationSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('adds missing instrumentation between children spans', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      const _spans = TraceTree.FromSpans(
        tree.root.children[0].children[0],
        childrenMissingInstrumentationSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('does not add missing instrumentation for browser SDKs', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      const _spans = TraceTree.FromSpans(
        tree.root.children[0].children[0],
        missingInstrumentationSpans,
        makeEventTransaction(),
        {
          sdk: 'sentry.javascript.browser',
        }
      );

      expect(TraceTree.Find(tree.root, c => isMissingInstrumentationNode(c))).toBeNull();
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it.each([
      ['children', childrenMissingInstrumentationSpans],
      ['siblings', missingInstrumentationSpans],
    ])('idempotent - %s', (_type, setup) => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      const _spans = TraceTree.FromSpans(
        tree.root.children[0].children[0],
        setup,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      const initial = tree.build().serialize();
      TraceTree.DetectMissingInstrumentation(tree.root, 100, undefined);
      expect(tree.build().serialize()).toMatchSnapshot();
      expect(tree.build().serialize()).toEqual(initial);
    });
  });

  describe('sibling autogrouping', () => {
    it('groups spans with the same op and description', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
  });

  describe('parent autogrouping', () => {
    it('groups parent chain with same op', () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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
      const _spans = TraceTree.FromSpans(
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

  describe('server side rendering', () => {
    it('reparents pageload transaction as parent of server handler', () => {
      const tree = TraceTree.FromTrace(ssrTrace, traceMetadata);

      const pageload = tree.root.children[0].children[0];
      const serverHandler = pageload.children[0];

      expect(serverHandler.parent).toBe(pageload);
      expect(pageload.parent).toBe(tree.root.children[0]);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('reparents server handler under browser request span', () => {
      const tree = TraceTree.FromTrace(ssrTrace, traceMetadata);

      const _spans = TraceTree.FromSpans(
        tree.root.children[0].children[0],
        ssrSpans,
        makeEventTransaction(),
        {
          sdk: undefined,
        }
      );

      expect(tree.build().serialize()).toMatchSnapshot();
    });
  });
});
