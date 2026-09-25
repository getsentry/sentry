import {OrganizationFixture} from 'sentry-fixture/organization';

import type {BaseNode} from './traceTreeNode/baseNode';
import type {EapSpanNode} from './traceTreeNode/eapSpanNode';
import type {UptimeCheckNode} from './traceTreeNode/uptimeCheckNode';
import type {UptimeCheckTimingNode} from './traceTreeNode/uptimeCheckTimingNode';
import {TraceShape, TraceTree} from './traceTree';
import {
  assertEAPSpanNode,
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
  makeEAPTrace,
  makeUptimeCheck,
} from './traceTreeTestUtils';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;
const organization = OrganizationFixture();
const traceOptions = {replay: null, organization};

const eapTrace = makeEAPTrace([
  makeEAPSpan({
    start_timestamp: start,
    end_timestamp: start + 2,
    children: [makeEAPSpan({start_timestamp: start + 1, end_timestamp: start + 4})],
  }),
]);

const eapTraceWithErrors = makeEAPTrace([
  makeEAPSpan({
    event_id: 'eap-span-1',
    is_transaction: true,
    errors: [],
    description: 'EAP span with error',
    children: [
      makeEAPSpan({
        event_id: 'eap-span-2',
        is_transaction: false,
        errors: [makeEAPError({event_id: 'eap-error-1'})],
      }),
    ],
  }),
]);

const eapTraceWithOccurences = makeEAPTrace([
  makeEAPSpan({
    event_id: 'eap-span-1',
    is_transaction: true,
    occurrences: [],
    children: [
      makeEAPSpan({
        event_id: 'eap-span-2',
        is_transaction: false,
        occurrences: [makeEAPOccurrence({event_id: 'eap-occurrence-1'})],
      }),
    ],
  }),
]);

const eapTraceWithOrphanErrors = makeEAPTrace([
  makeEAPError({event_id: 'eap-error-1', description: 'Error description 1'}),
  makeEAPError({
    event_id: 'eap-error-2',
    description: 'Error description 2',
    level: 'info',
  }),
]);

describe('TraceTree', () => {
  describe('eap trace', () => {
    it('assembles tree from eap trace', () => {
      const tree = TraceTree.FromTrace(eapTrace, traceOptions);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('assembles tree from eap trace with only errors', () => {
      const tree = TraceTree.FromTrace(eapTraceWithOrphanErrors, traceOptions);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('adds eap errors to tree nodes', () => {
      const tree = TraceTree.FromTrace(eapTraceWithErrors, traceOptions);

      expect(tree.root.children[0]!.errors.size).toBe(1);

      const eapTransaction = tree.root.findChild(n => n.id === 'eap-span-1');
      const eapSpan = tree.root.findChild(n => n.id === 'eap-span-2');

      expect(eapTransaction?.errors.size).toBe(1);
      expect(eapSpan?.errors.size).toBe(1);
    });

    it('adds eap occurrences to tree nodes', () => {
      const tree = TraceTree.FromTrace(eapTraceWithOccurences, traceOptions);

      expect(tree.root.children[0]!.occurrences.size).toBe(1);

      const eapTransaction = tree.root.findChild(n => n.id === 'eap-span-1');
      const eapSpan = tree.root.findChild(n => n.id === 'eap-span-2');

      expect(eapTransaction?.occurrences.size).toBe(1);
      expect(eapSpan?.occurrences.size).toBe(1);
    });

    it('initializes eap span ops breakdown', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            is_transaction: true,
            op: 'op-1',
            occurrences: [],
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                is_transaction: false,
                op: 'op-2',
                children: [
                  makeEAPSpan({
                    event_id: 'eap-span-4',
                    is_transaction: false,
                    op: 'op-3',
                    occurrences: [],
                    children: [],
                  }),
                ],
              }),
              makeEAPSpan({
                event_id: 'eap-span-3',
                is_transaction: true,
                op: 'op-2',
                occurrences: [],
                children: [],
              }),
            ],
          }),
        ]),
        traceOptions
      );

      const eapSpan1 = tree.root.findChild(n => n.id === 'eap-span-1');
      expect((eapSpan1 as EapSpanNode).opsBreakdown).toEqual(
        expect.arrayContaining([
          {op: 'op-2', count: 2},
          {op: 'op-3', count: 1},
        ])
      );

      const eapSpan2 = tree.root.findChild(n => n.id === 'eap-span-2');
      expect((eapSpan2 as EapSpanNode).opsBreakdown).toEqual(
        expect.arrayContaining([{op: 'op-3', count: 1}])
      );

      const eapSpan3 = tree.root.findChild(n => n.id === 'eap-span-3');
      expect((eapSpan3 as EapSpanNode).opsBreakdown).toEqual([]);

      const eapSpan4 = tree.root.findChild(n => n.id === 'eap-span-4');
      expect((eapSpan4 as EapSpanNode).opsBreakdown).toEqual([]);
    });

    it('initializes expanded based on is_transaction property', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                start_timestamp: start + 1,
                end_timestamp: start + 4,
                is_transaction: false,
                children: [],
              }),
            ],
          }),
        ]),
        {replay: null, organization}
      );

      // eap-span-1 is a transaction/segment and should be collapsed
      expect(tree.root.findChild(n => n.id === 'eap-span-1')?.expanded).toBe(false);

      // eap-span-2 is a span and should be expanded
      expect(tree.root.findChild(n => n.id === 'eap-span-2')?.expanded).toBe(true);
    });

    it('correctly renders eap-transactions toggle state', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true, // is a transaction
            parent_span_id: undefined,
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                start_timestamp: start + 1,
                end_timestamp: start + 4,
                is_transaction: false,
                parent_span_id: 'eap-span-1',
                children: [
                  makeEAPSpan({
                    event_id: 'eap-span-3',
                    start_timestamp: start + 2,
                    end_timestamp: start + 3,
                    is_transaction: true, // is a transaction
                    parent_span_id: 'eap-span-2',
                    children: [
                      makeEAPSpan({
                        event_id: 'eap-span-4',
                        start_timestamp: start + 3,
                        end_timestamp: start + 4,
                        is_transaction: false,
                        parent_span_id: 'eap-span-3',
                        children: [
                          makeEAPSpan({
                            event_id: 'eap-span-5',
                            start_timestamp: start + 4,
                            end_timestamp: start + 5,
                            is_transaction: true, // is a transaction
                            parent_span_id: 'eap-span-4',
                            children: [],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]),
        traceOptions
      );

      // Assert initial state
      expect(tree.build().serialize()).toMatchSnapshot();

      // Assert expaneded state
      const eapTxn = tree.root.findChild(n => n.id === 'eap-span-1');
      eapTxn!.expand(true, tree);
      expect(tree.build().serialize()).toMatchSnapshot();

      // Assert state upon collapsing
      eapTxn!.expand(false, tree);
      expect(tree.build().serialize()).toMatchSnapshot();
    });

    it('preserves actual parents while summarizing collapsed EAP transactions', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'root-transaction',
            is_transaction: true,
            start_timestamp: start,
            end_timestamp: start + 5,
            children: [
              makeEAPSpan({
                event_id: 'span-a',
                is_transaction: false,
                parent_span_id: 'root-transaction',
                start_timestamp: start + 1,
                end_timestamp: start + 2,
                children: [
                  makeEAPSpan({
                    event_id: 'child-transaction-a',
                    is_transaction: true,
                    parent_span_id: 'span-a',
                    start_timestamp: start + 1.25,
                    end_timestamp: start + 2,
                    children: [],
                  }),
                ],
              }),
              makeEAPSpan({
                event_id: 'span-b',
                is_transaction: false,
                parent_span_id: 'root-transaction',
                start_timestamp: start + 3,
                end_timestamp: start + 4,
                children: [
                  makeEAPSpan({
                    event_id: 'child-transaction-b',
                    is_transaction: true,
                    parent_span_id: 'span-b',
                    start_timestamp: start + 3.25,
                    end_timestamp: start + 4,
                    children: [],
                  }),
                ],
              }),
            ],
          }),
        ]),
        traceOptions
      ).build();

      const rootTransaction = tree.root.findChild(n => n.id === 'root-transaction');
      const spanA = tree.root.findChild(n => n.id === 'span-a');
      const spanB = tree.root.findChild(n => n.id === 'span-b');
      const childTransactionA = tree.root.findChild(n => n.id === 'child-transaction-a');
      const childTransactionB = tree.root.findChild(n => n.id === 'child-transaction-b');

      assertEAPSpanNode(rootTransaction);
      assertEAPSpanNode(spanA);
      assertEAPSpanNode(spanB);
      assertEAPSpanNode(childTransactionA);
      assertEAPSpanNode(childTransactionB);

      expect(rootTransaction.children).toEqual([spanA, spanB]);
      expect(childTransactionA.parent).toBe(spanA);
      expect(childTransactionB.parent).toBe(spanB);
      expect(rootTransaction.directVisibleChildren).toEqual([
        childTransactionA,
        childTransactionB,
      ]);
      expect(TraceTree.VisibleParent(childTransactionA)).toBe(rootTransaction);
      expect(TraceTree.VisibleParent(childTransactionB)).toBe(rootTransaction);
      expect(TraceTree.depth(childTransactionA)).toBe(
        TraceTree.depth(rootTransaction) + 1
      );
      expect(TraceTree.depth(childTransactionB)).toBe(
        TraceTree.depth(rootTransaction) + 1
      );
      expect(TraceTree.IsLastVisibleChild(childTransactionA)).toBe(false);
      expect(TraceTree.IsLastVisibleChild(childTransactionB)).toBe(true);
      const rootTransactionIndex = tree.list.indexOf(rootTransaction);
      expect(tree.list.slice(rootTransactionIndex, rootTransactionIndex + 3)).toEqual([
        rootTransaction,
        childTransactionA,
        childTransactionB,
      ]);

      rootTransaction.expand(true, tree);

      expect(childTransactionA.parent).toBe(spanA);
      expect(childTransactionB.parent).toBe(spanB);
      expect(TraceTree.VisibleParent(childTransactionA)).toBe(spanA);
      expect(TraceTree.VisibleParent(childTransactionB)).toBe(spanB);
      expect(TraceTree.depth(childTransactionA)).toBe(TraceTree.depth(spanA) + 1);
      expect(TraceTree.depth(childTransactionB)).toBe(TraceTree.depth(spanB) + 1);
      expect(tree.list.slice(rootTransactionIndex, rootTransactionIndex + 5)).toEqual([
        rootTransaction,
        spanA,
        childTransactionA,
        spanB,
        childTransactionB,
      ]);
    });

    it('collects measurements', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            measurements: {
              'measurements.fcp': 100,
              'measurements.lcp': 200,
            },
            children: [
              makeEAPSpan({
                event_id: 'eap-span-2',
                start_timestamp: start + 1,
                end_timestamp: start + 4,
                is_transaction: false,
                children: [],
              }),
            ],
          }),
        ]),
        {replay: null, organization}
      );

      expect(tree.vitals.size).toBe(1);

      const span1 = tree.root.findChild(n => n.id === 'eap-span-1');
      expect(tree.vitals.get(span1!)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'fcp',
            measurement: {value: 100},
            timestamp: start * 1e3 + 100,
          }),
          expect.objectContaining({
            key: 'lcp',
            measurement: {value: 200},
            timestamp: start * 1e3 + 200,
          }),
        ])
      );

      expect(tree.indicators).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'fcp',
            label: 'FCP',
            measurement: {value: 100},
          }),
          expect.objectContaining({
            type: 'lcp',
            label: 'LCP',
            measurement: {value: 200},
          }),
        ])
      );
    });

    it('falls back to browser web vital values for zero measurements', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            measurements: {
              'measurements.lcp': 0,
            },
            browser_web_vital: {
              'browser.web_vital.lcp.value': 200,
            },
            children: [],
          }),
        ]),
        {replay: null, organization}
      );

      const span1 = tree.root.findChild(n => n.id === 'eap-span-1');
      expect(tree.vitals.get(span1!)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({key: 'lcp', measurement: {value: 200}}),
        ])
      );
      expect(tree.vital_types).toEqual(new Set(['web']));
      expect(tree.indicators).toEqual(
        expect.arrayContaining([
          expect.objectContaining({type: 'lcp', measurement: {value: 200}}),
        ])
      );
    });

    it('collects mobile vitals from app vital values', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            mobile_app_vital: {
              'app.vitals.start.cold.value': 1600,
              'app.vitals.start.warm.value': 400,
              'app.vitals.ttid.value': 1200,
              'app.vitals.ttfd.value': 2400,
            },
            children: [],
          }),
        ]),
        {replay: null, organization}
      );

      const span1 = tree.root.findChild(n => n.id === 'eap-span-1');
      expect(tree.vitals.get(span1!)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'app_start_cold',
            measurement: {value: 1600},
          }),
          expect.objectContaining({
            key: 'app_start_warm',
            measurement: {value: 400},
          }),
          expect.objectContaining({
            key: 'time_to_initial_display',
            measurement: {value: 1200},
          }),
          expect.objectContaining({
            key: 'time_to_full_display',
            measurement: {value: 2400},
          }),
        ])
      );
      expect(tree.vital_types).toEqual(new Set(['mobile']));
    });

    it('standalone LCP span indicator takes priority over pageload LCP indicator', () => {
      const standaloneStart = start + 1.5;
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'pageload-span',
            op: 'pageload',
            start_timestamp: start,
            end_timestamp: start + 2,
            is_transaction: true,
            measurements: {
              'measurements.lcp': 500,
            },
            children: [],
          }),
          makeEAPSpan({
            event_id: 'standalone-lcp-span',
            op: 'ui.webvital.lcp',
            start_timestamp: standaloneStart,
            end_timestamp: standaloneStart + 0.1,
            is_transaction: false,
            measurements: {
              'measurements.lcp': 500,
            },
            children: [],
          }),
        ]),
        {replay: null, organization}
      );

      const lcpIndicators = tree.indicators.filter(i => i.type === 'lcp');
      expect(lcpIndicators).toHaveLength(1);
      expect(lcpIndicators[0]!.start).toBe(standaloneStart * 1e3 + 500);
      expect(lcpIndicators[0]!.node.id).toBe('standalone-lcp-span');
    });

    it.each<{
      additionalAttributes: Record<string, string | number>;
      attributeName: string;
    }>([
      {
        additionalAttributes: {
          'tags[browser.performance.time_origin,number]': start,
        },
        attributeName: 'replacement',
      },
      {
        additionalAttributes: {
          'tags[performance.timeOrigin,number]': start,
        },
        attributeName: 'deprecated',
      },
    ])(
      'applies standalone LCP measurement offset using the $attributeName trace origin attribute',
      ({additionalAttributes}) => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              event_id: 'pageload-span',
              op: 'pageload',
              start_timestamp: start,
              end_timestamp: start + 2,
              is_transaction: true,
              additional_attributes: additionalAttributes,
              measurements: {
                'measurements.lcp': 500,
              },
              children: [],
            }),
            makeEAPSpan({
              event_id: 'standalone-lcp-span',
              op: 'ui.webvital.lcp',
              start_timestamp: start + 1.5,
              end_timestamp: start + 1.6,
              is_transaction: false,
              measurements: {
                'measurements.lcp': 1240,
              },
              children: [],
            }),
          ]),
          {replay: null, organization}
        );

        const lcpIndicators = tree.indicators.filter(i => i.type === 'lcp');
        expect(lcpIndicators).toHaveLength(1);
        expect(lcpIndicators[0]!.start).toBe(start * 1e3 + 1240);
      }
    );

    it('handles cycles in EAP trace structure without infinite loop', () => {
      const cyclicSpan = makeEAPSpan({
        event_id: 'cyclic-span',
        is_transaction: false,
        children: [],
      });

      cyclicSpan.children = [cyclicSpan];

      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'root-span',
            is_transaction: true,
            children: [cyclicSpan],
          }),
        ]),
        {replay: null, organization}
      );

      expect(tree.build()).toBeDefined();

      const cyclicNodes: BaseNode[] = [];
      tree.root.forEachChild(node => {
        if (node.id === 'cyclic-span') {
          cyclicNodes.push(node);
        }
      });
      expect(cyclicNodes).toHaveLength(1);
    });
  });

  it('expands loaded EAP ancestors from a path', async () => {
    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'parent-event-id',
          is_transaction: true,
          children: [makeEAPSpan({event_id: 'child-event-id'})],
        }),
      ]),
      traceOptions
    );
    const child = tree.root.findChild(node => node.id === 'child-event-id')!;

    expect(tree.list).not.toContain(child);
    await TraceTree.ExpandToPath(tree, child.pathToNode());

    expect(tree.list).toContain(child);
    expect(tree.root.findChild(node => node.id === 'parent-event-id')!.expanded).toBe(
      true
    );
  });

  describe('uptime check integration', () => {
    function isUptimeCheckTimingNode(node: BaseNode): node is UptimeCheckTimingNode {
      return !!(
        node.value &&
        'event_type' in node.value &&
        node.value.event_type === 'uptime_check_timing'
      );
    }

    function isUptimeCheckNode(node: BaseNode): node is UptimeCheckNode {
      return !!(
        node.value &&
        'event_type' in node.value &&
        node.value.event_type === 'uptime_check'
      );
    }

    it('automatically creates timing nodes when uptime check node is created', () => {
      const uptimeCheck = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: '50000',
          dns_lookup_start_us: '0',
          tcp_connection_duration_us: '100000',
          tcp_connection_start_us: '50000',
          tls_handshake_duration_us: '200000',
          tls_handshake_start_us: '150000',
          send_request_duration_us: '25000',
          send_request_start_us: '350000',
          time_to_first_byte_duration_us: '500000',
          time_to_first_byte_start_us: '375000',
          receive_response_duration_us: '100000',
          receive_response_start_us: '875000',
        },
      });

      const tree = TraceTree.FromTrace([uptimeCheck], traceOptions);

      // Find the uptime check node in the tree
      const uptimeNode = tree.root.findChild(node => isUptimeCheckNode(node));
      expect(uptimeNode).toBeDefined();

      // Check that timing nodes were automatically added as children
      const timingChildren = uptimeNode?.children.filter(child =>
        isUptimeCheckTimingNode(child)
      );
      expect(timingChildren).toHaveLength(6);

      // Verify each timing phase is present with correct metrics
      const dnsNode = timingChildren?.find(
        child => child.value.op === 'dns.lookup.duration'
      );
      expect(dnsNode).toBeDefined();
      expect(dnsNode?.value.description).toBe('DNS lookup');
      expect(dnsNode?.value.duration).toBe(0.05); // 50000us = 0.05s

      const tcpNode = timingChildren?.find(
        child => child.value.op === 'http.tcp_connection.duration'
      );
      expect(tcpNode).toBeDefined();
      expect(tcpNode?.value.description).toBe('TCP connect');
      expect(tcpNode?.value.duration).toBe(0.1); // 100000us = 0.1s

      const tlsNode = timingChildren?.find(
        child => child.value.op === 'tls.handshake.duration'
      );
      expect(tlsNode).toBeDefined();
      expect(tlsNode?.value.description).toBe('TLS handshake');
      expect(tlsNode?.value.duration).toBe(0.2); // 200000us = 0.2s

      const requestNode = timingChildren?.find(
        child => child.value.op === 'http.client.request.duration'
      );
      expect(requestNode).toBeDefined();
      expect(requestNode?.value.description).toBe('Send request');
      expect(requestNode?.value.duration).toBe(0.025); // 25000us = 0.025s

      const ttfbNode = timingChildren?.find(
        child => child.value.op === 'http.server.time_to_first_byte'
      );
      expect(ttfbNode).toBeDefined();
      expect(ttfbNode?.value.description).toBe('Waiting for response');
      expect(ttfbNode?.value.duration).toBe(0.5); // 500000us = 0.5s

      const responseNode = timingChildren?.find(
        child => child.value.op === 'http.client.response.duration'
      );
      expect(responseNode).toBeDefined();
      expect(responseNode?.value.description).toBe('Receive response');
      expect(responseNode?.value.duration).toBe(0.1); // 100000us = 0.1s
    });

    it('handles missing timing attributes gracefully', () => {
      const uptimeCheck = makeUptimeCheck({
        additional_attributes: {
          dns_lookup_duration_us: '50000',
          dns_lookup_start_us: '0',
          // Missing other timing attributes
        },
      });

      const tree = TraceTree.FromTrace([uptimeCheck], traceOptions);

      const uptimeNode = tree.root.findChild(node => isUptimeCheckNode(node));
      const timingChildren = uptimeNode?.children.filter(child =>
        isUptimeCheckTimingNode(child)
      );

      expect(timingChildren).toHaveLength(6);

      // Should still create all nodes, but with 0 duration for missing attributes
      const tcpNode = timingChildren?.find(
        child => child.value.op === 'http.tcp_connection.duration'
      );
      expect(tcpNode?.value.duration).toBe(0);
    });
  });

  describe('EAP traces', () => {
    it('returns EMPTY_TRACE for empty EAP trace', () => {
      const tree = TraceTree.FromTrace(makeEAPTrace([]), traceOptions);

      expect(tree.shape).toBe(TraceShape.EMPTY_TRACE);
    });

    it('returns ONLY_ERRORS for EAP trace with only errors', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPError({
            event_id: 'error-1',
            description: 'Test error',
          }),
          makeEAPError({
            event_id: 'error-2',
            description: 'Another error',
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.ONLY_ERRORS);
    });

    it('returns NO_ROOT for EAP trace with only non-root spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            parent_span_id: 'some-parent',
            is_transaction: false,
          }),
          makeEAPSpan({
            parent_span_id: 'another-parent',
            is_transaction: false,
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.NO_ROOT);
    });

    it('returns ONE_ROOT for EAP trace with single root span', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
            children: [
              makeEAPSpan({
                parent_span_id: 'root-span-id',
                is_transaction: false,
              }),
            ],
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.ONE_ROOT);
    });

    it('returns BROKEN_SUBTRACES for EAP trace with root and orphan spans', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
          }),
          makeEAPSpan({
            parent_span_id: 'non-existent-parent',
            is_transaction: false,
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.BROKEN_SUBTRACES);
    });

    it('returns BROWSER_MULTIPLE_ROOTS for EAP trace with multiple roots including JavaScript SDK', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
            transaction: 'pageload',
            sdk_name: 'sentry.javascript.browser',
            op: 'pageload',
          }),
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
            transaction: 'backend',
            op: 'http.server',
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.BROWSER_MULTIPLE_ROOTS);
    });

    it('returns MULTIPLE_ROOTS for EAP trace with multiple non-JavaScript roots', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
            transaction: 'backend-1',
            op: 'http.server',
          }),
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
            transaction: 'backend-2',
            op: 'db.query',
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.MULTIPLE_ROOTS);
    });

    it('handles mixed EAP trace with spans and errors correctly', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            parent_span_id: null,
            is_transaction: true,
            children: [],
          }),
          makeEAPError({
            event_id: 'error-1',
            description: 'Orphan error',
          }),
        ]),
        traceOptions
      );

      expect(tree.shape).toBe(TraceShape.ONE_ROOT);
    });
  });
});
