import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  makeEAPSpan,
  makeEAPTrace,
  makeSpan,
  makeTrace,
  makeTransaction,
  mockSpansResponse,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import {isParentAutogroupedNode, isSiblingAutogroupedNode} from './../traceGuards';
import {TraceTree} from './traceTree';

const organization = OrganizationFixture();

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const traceMetadata = {replay: null, meta: null, organization};

const options = {
  organization,
};

const singleTransactionTrace = makeTrace({
  transactions: [
    makeTransaction({
      start_timestamp: start,
      timestamp: start + 2,
      children: [],
      event_id: 'event-id',
      project_slug: 'project',
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

const siblingAutogroupEAPSpans = [
  makeEAPSpan({
    op: 'http.server',
    description: 'redis',
    event_id: '0000',
    children: [
      makeEAPSpan({
        event_id: '0001',
        op: 'db',
        description: 'redis',
        start_timestamp: start,
        end_timestamp: start + 1,
        parent_span_id: '0000',
      }),
      makeEAPSpan({
        event_id: '0002',
        op: 'db',
        description: 'redis',
        start_timestamp: start,
        end_timestamp: start + 1,
        parent_span_id: '0000',
      }),
      makeEAPSpan({
        event_id: '0003',
        op: 'db',
        description: 'redis',
        start_timestamp: start,
        end_timestamp: start + 1,
        parent_span_id: '0000',
      }),
      makeEAPSpan({
        event_id: '0004',
        op: 'db',
        description: 'redis',
        start_timestamp: start,
        end_timestamp: start + 1,
        parent_span_id: '0000',
      }),
      makeEAPSpan({
        event_id: '0005',
        op: 'db',
        description: 'redis',
        start_timestamp: start,
        end_timestamp: start + 1,
        parent_span_id: '0000',
      }),
    ],
  }),
];

const parentAutogroupSpans = [
  makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0001', parent_span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0002', parent_span_id: '0001'}),
];

const parentAutogroupEAPSpans = [
  makeEAPSpan({
    op: 'db',
    description: 'redis',
    event_id: '0000',
    children: [
      makeEAPSpan({
        op: 'db',
        description: 'redis',
        event_id: '0001',
        parent_span_id: '0000',
        children: [
          makeEAPSpan({
            op: 'db',
            description: 'redis',
            event_id: '0002',
            parent_span_id: '0001',
          }),
        ],
      }),
    ],
  }),
];

const parentAutogroupSpansWithChilden = [
  makeSpan({op: 'db', description: 'redis', span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0001', parent_span_id: '0000'}),
  makeSpan({op: 'db', description: 'redis', span_id: '0002', parent_span_id: '0001'}),
  makeSpan({op: 'http', description: 'request', span_id: '0003', parent_span_id: '0002'}),
];

describe('autogrouping', () => {
  describe('parent autogrouping', () => {
    it('groups parent chain with same op', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(parentAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('assigns children to tail node', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(
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
        'project',
        'event-id'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('autogrouped chain points to tail', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(
        [
          ...parentAutogroupSpans,
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id:
              parentAutogroupSpans[parentAutogroupSpans.length - 1]!.span_id,
          }),
        ],
        'project',
        'event-id'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('expanding parent autogroup renders head to tail chain', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(parentAutogroupSpans, 'project', 'event-id');

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing parent autogroup removes its children', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(parentAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();

      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(false, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('can expand and collapse', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(
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
        'project',
        'event-id'
      );

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const initial = tree.build().serialize();

      // Expand autogroup part
      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();

      // Collapse autogroup part
      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(false, tree);
        }
      });

      // Tree should be back to initial state
      expect(tree.build().serialize()).toEqual(initial);
    });

    it('autogroups siblings when they are children of a parent autogroup chain', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(
        [
          ...parentAutogroupSpans,
          ...[1, 2, 3, 4, 5].map(_i =>
            makeSpan({
              op: 'db',
              description: 'sql',
              start_timestamp: start,
              timestamp: start + 1,
              parent_span_id:
                parentAutogroupSpans[parentAutogroupSpans.length - 1]!.span_id,
            })
          ),
        ],
        'project',
        'event-id'
      );

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          autogroup: {parent: false, sibling: false},
          missing_instrumentation: false,
        },
      });

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);
      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes collapsed parent autogroup', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(parentAutogroupSpansWithChilden, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          autogroup: {parent: false, sibling: false},
        },
      });

      const snapshot = tree.build().serialize();
      // Add sibling autogroup
      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      expect(tree.root.findChild(c => isParentAutogroupedNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveDirectChildrenAutogroupNodes(tree.root);

      expect(tree.root.findChild(c => isParentAutogroupedNode(c))).toBeNull();
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes expanded parent autogroup', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(parentAutogroupSpansWithChilden, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          autogroup: {parent: false, sibling: false},
        },
      });

      const snapshot = tree.build().serialize();
      // Add sibling autogroup
      TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      tree.root.forEachChild(c => {
        if (isParentAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
      expect(tree.root.findChild(c => isParentAutogroupedNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveDirectChildrenAutogroupNodes(tree.root);
      expect(tree.root.findChild(c => isParentAutogroupedNode(c))).toBeNull();
      tree.root.invalidate();
      tree.root.forEachChild(c => {
        c.invalidate();
      });
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    describe('eap traces', () => {
      it('groups parent chain with same op', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(parentAutogroupEAPSpans),
          traceMetadata
        );

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('assigns children to tail node', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              op: 'db',
              description: 'redis',
              event_id: '0000',
              children: [
                makeEAPSpan({
                  op: 'db',
                  description: 'redis',
                  event_id: '0001',
                  parent_span_id: '0000',
                  children: [
                    makeEAPSpan({
                      op: 'db',
                      description: 'redis',
                      event_id: '0002',
                      parent_span_id: '0001',
                      children: [
                        makeEAPSpan({
                          op: 'http.server',
                          description: 'redis',
                          event_id: '0003',
                          parent_span_id: '0002',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ]),
          traceMetadata
        );

        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('collapsing parent autogroup removes its children', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(parentAutogroupEAPSpans),
          traceMetadata
        );
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);

        tree.root.forEachChild(c => {
          if (isParentAutogroupedNode(c)) {
            c.expand(true, tree);
          }
        });

        expect(tree.build().serialize()).toMatchSnapshot();

        tree.root.forEachChild(c => {
          if (isParentAutogroupedNode(c)) {
            c.expand(false, tree);
          }
        });

        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('removes collapsed parent autogroup', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(parentAutogroupEAPSpans),
          traceMetadata
        );
        const snapshot = tree.build().serialize();

        // Add children autogroup
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
        expect(tree.root.findChild(c => isParentAutogroupedNode(c))).not.toBeNull();

        // Remove it and assert that the tree is back to the original state
        TraceTree.RemoveDirectChildrenAutogroupNodes(tree.root);

        expect(tree.root.findChild(c => isParentAutogroupedNode(c))).toBeNull();
        expect(tree.build().serialize()).toEqual(snapshot);
        expect(tree.build().serialize()).toMatchSnapshot();
      });
    });
  });

  describe('sibling autogrouping', () => {
    it('groups spans with the same op and description', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('does not autogroup if count is less 5', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(siblingAutogroupSpans.slice(0, 4), 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('autogroups multiple consecutive groups', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(
        [
          ...siblingAutogroupSpans,
          ...siblingAutogroupSpans.map(s => ({...s, op: 'mysql'})),
        ],
        'project',
        'event-id'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('expanding sibling autogroup renders its children', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.root.forEachChild(c => {
        if (isSiblingAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });

      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('collapsing sibling autogroup removes its children', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      tree.root.forEachChild(c => {
        if (isSiblingAutogroupedNode(c)) {
          c.expand(true, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
      tree.root.forEachChild(c => {
        if (isSiblingAutogroupedNode(c)) {
          c.expand(false, tree);
        }
      });
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('removes sibling autogroup', async () => {
      const tree = TraceTree.FromTrace(singleTransactionTrace, traceMetadata);
      mockSpansResponse(siblingAutogroupSpans, 'project', 'event-id');
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: {
          ...DEFAULT_TRACE_VIEW_PREFERENCES,
          autogroup: {parent: false, sibling: false},
        },
      });

      const snapshot = tree.build().serialize();

      // Add sibling autogroup
      TraceTree.AutogroupSiblingSpanNodes(tree.root, options);
      expect(tree.root.findChild(c => isSiblingAutogroupedNode(c))).not.toBeNull();

      // Remove it and assert that the tree is back to the original state
      TraceTree.RemoveSiblingAutogroupNodes(tree.root);
      expect(tree.build().serialize()).toEqual(snapshot);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it.todo(
      'collects errors, performance issues and profiles from sibling autogroup chain'
    );

    describe('eap traces', () => {
      it('groups spans with the same op and description', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(siblingAutogroupEAPSpans),
          traceMetadata
        );

        TraceTree.AutogroupSiblingSpanNodes(tree.root, options);
        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('groups spans with the same op and name if OTel UI is enabled', () => {
        const OTELOrganization = OrganizationFixture({
          features: [...OrganizationFixture().features, 'performance-otel-friendly-ui'],
        });

        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              op: 'http.server',
              description: 'redis',
              name: 'redis',
              event_id: '0000',
              children: [
                makeEAPSpan({
                  event_id: '0001',
                  op: 'db',
                  name: 'GET',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
                makeEAPSpan({
                  event_id: '0002',
                  op: 'db',
                  name: 'GET',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
                makeEAPSpan({
                  event_id: '0003',
                  op: 'db',
                  name: 'GET',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
                makeEAPSpan({
                  event_id: '0003',
                  op: 'db',
                  name: 'GET',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
                makeEAPSpan({
                  event_id: '0003',
                  op: 'db',
                  name: 'GET',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
              ],
            }),
          ]),
          {
            ...traceMetadata,
            organization: OTELOrganization,
          }
        );

        TraceTree.AutogroupSiblingSpanNodes(tree.root, {
          organization: OTELOrganization,
        });
        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('does not autogroup if count is less 5', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              op: 'http.server',
              description: 'redis',
              event_id: '0000',
              children: [
                makeEAPSpan({
                  event_id: '0001',
                  op: 'db',
                  description: 'redis',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
                makeEAPSpan({
                  event_id: '0002',
                  op: 'db',
                  description: 'redis',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
                makeEAPSpan({
                  event_id: '0003',
                  op: 'db',
                  description: 'redis',
                  start_timestamp: start,
                  end_timestamp: start + 1,
                  parent_span_id: '0000',
                }),
              ],
            }),
          ]),
          traceMetadata
        );

        TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('expanding sibling autogroup renders its children', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(siblingAutogroupEAPSpans),
          traceMetadata
        );

        TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

        tree.root.forEachChild(c => {
          if (isSiblingAutogroupedNode(c)) {
            c.expand(true, tree);
          }
        });

        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('collapsing sibling autogroup removes its children', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(siblingAutogroupEAPSpans),
          traceMetadata
        );

        TraceTree.AutogroupSiblingSpanNodes(tree.root, options);

        tree.root.forEachChild(c => {
          if (isSiblingAutogroupedNode(c)) {
            c.expand(true, tree);
          }
        });
        expect(tree.build().serialize()).toMatchSnapshot();
        tree.root.forEachChild(c => {
          if (isSiblingAutogroupedNode(c)) {
            c.expand(false, tree);
          }
        });
        expect(tree.build().serialize()).toMatchSnapshot();
      });

      it('removes sibling autogroup', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace(siblingAutogroupEAPSpans),
          traceMetadata
        );

        const snapshot = tree.build().serialize();

        // Add sibling autogroup
        TraceTree.AutogroupSiblingSpanNodes(tree.root, options);
        expect(tree.root.findChild(c => isSiblingAutogroupedNode(c))).not.toBeNull();

        // Remove it and assert that the tree is back to the original state
        TraceTree.RemoveSiblingAutogroupNodes(tree.root);
        expect(tree.build().serialize()).toEqual(snapshot);
        expect(tree.build().serialize()).toMatchSnapshot();
      });
    });
  });
});
