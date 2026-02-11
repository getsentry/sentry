import {OrganizationFixture} from 'sentry-fixture/organization';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeSpan,
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
  mockSpansResponse,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {searchInTraceTreeTokens} from 'sentry/views/performance/newTraceDetails/traceSearch/traceSearchEvaluator';
import {parseTraceSearch} from 'sentry/views/performance/newTraceDetails/traceSearch/traceTokenConverter';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

const search = (query: string, tree: TraceTree, cb: any) => {
  searchInTraceTreeTokens(
    tree,
    // @ts-expect-error dont care if this fails
    parseTraceSearch(query),
    null,
    cb
  );
};

const organization = OrganizationFixture();

describe('TraceSearchEvaluator', () => {
  it('empty string', async () => {
    const list = TraceTree.FromTrace(
      {
        transactions: [
          makeTransaction({'transaction.op': 'operation'}),
          makeTransaction({'transaction.op': 'other'}),
        ],
        orphan_errors: [],
      },
      {
        meta: null,
        replay: null,
        organization,
      }
    );

    const cb = jest.fn();
    search('', list, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][0]).toEqual([]);
    expect(cb.mock.calls[0][0][1].size).toBe(0);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });
  it.each([
    [''],
    ['invalid_query'],
    ['invalid_query:'],
    ['OR'],
    ['AND'],
    ['('],
    [')'],
    ['()'],
    ['(invalid_query)'],
  ])('invalid grammar %s', async query => {
    const list = TraceTree.FromTrace(
      {
        transactions: [
          makeTransaction({'transaction.op': 'operation'}),
          makeTransaction({'transaction.op': 'other'}),
        ],
        orphan_errors: [],
      },
      {
        meta: null,
        replay: null,
        organization,
      }
    );

    const cb = jest.fn();
    search(query, list, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][0]).toEqual([]);
    expect(cb.mock.calls[0][0][1].size).toBe(0);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  it('AND query', async () => {
    const tree = TraceTree.FromTrace(
      {
        transactions: [
          makeTransaction({'transaction.op': 'operation', transaction: 'something'}),
          makeTransaction({'transaction.op': 'other'}),
        ],
        orphan_errors: [],
      },
      {
        meta: null,
        replay: null,
        organization,
      }
    );
    tree.build();

    const cb = jest.fn();
    search('transaction.op:operation AND transaction:something', tree, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });

    expect(cb.mock.calls[0][0][1].size).toBe(1);
    expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  it('OR query', async () => {
    const tree = TraceTree.FromTrace(
      {
        transactions: [
          makeTransaction({'transaction.op': 'operation'}),
          makeTransaction({'transaction.op': 'other'}),
        ],
        orphan_errors: [],
      },
      {
        meta: null,
        replay: null,
        organization,
      }
    );
    tree.build();

    const cb = jest.fn();
    search('transaction.op:operation OR transaction.op:other', tree, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][0]).toEqual([
      {index: 1, value: tree.list[1]},
      {index: 2, value: tree.list[2]},
    ]);
    expect(cb.mock.calls[0][0][1].size).toBe(2);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  it('OR with AND respects precedence', async () => {
    const tree = TraceTree.FromTrace(
      {
        transactions: [
          makeTransaction({'transaction.op': 'operation', transaction: 'something'}),
          makeTransaction({'transaction.op': 'other', transaction: ''}),
        ],
        orphan_errors: [],
      },
      {
        meta: null,
        replay: null,
        organization,
      }
    );
    tree.build();

    const cb = jest.fn();
    search(
      'transaction.op:operation AND transaction:something OR transaction.op:other',
      tree,
      cb
    );
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][1].size).toBe(2);
    expect(cb.mock.calls[0][0][0]).toEqual([
      {index: 1, value: tree.list[1]},
      {index: 2, value: tree.list[2]},
    ]);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  describe('transaction', () => {
    it('text filter', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({'transaction.op': 'operation'}),
            makeTransaction({'transaction.op': 'other'}),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('transaction.op:operation', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('text filter with prefix', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [makeTransaction({transaction: 'operation'})],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('transaction.transaction:operation', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('transaction.duration (milliseconds)', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({'transaction.duration': 1000}),
            makeTransaction({'transaction.duration': 500}),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('transaction.duration:>500ms', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('transaction.duration (seconds)', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({'transaction.duration': 1000}),
            makeTransaction({'transaction.duration': 500}),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('transaction.duration:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('transaction.total_time', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({start_timestamp: 0, timestamp: 1}),
            makeTransaction({start_timestamp: 0, timestamp: 0.5}),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('transaction.total_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    // For consistency between spans and txns, `transaction.self_time` should be implemented
  });

  describe('span', () => {
    it('text filter', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      mockSpansResponse(
        [makeSpan({op: 'db'}), makeSpan({op: 'http'})],
        'project-1',
        'txn-1'
      );

      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('text filter with prefix', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [makeSpan({op: 'db'}), makeSpan({op: 'http'})],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('span.op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (milliseconds)', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [
          makeSpan({start_timestamp: 0, timestamp: 1}),
          makeSpan({start_timestamp: 0, timestamp: 0.5}),
        ],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('span.duration:>500ms', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (seconds)', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [
          makeSpan({start_timestamp: 0, timestamp: 1}),
          makeSpan({start_timestamp: 0, timestamp: 0.5}),
        ],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('span.duration:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.total_time', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [
          makeSpan({start_timestamp: 0, timestamp: 1}),
          makeSpan({start_timestamp: 0, timestamp: 0.5}),
        ],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('span.total_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('span.self_time', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [makeSpan({exclusive_time: 1000}), makeSpan({exclusive_time: 500})],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('span.self_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('span.exclusive_time', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [makeSpan({exclusive_time: 1000}), makeSpan({exclusive_time: 500})],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('span.exclusive_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('exclusive_time', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [
            makeTransaction({
              'transaction.op': 'operation',
              event_id: 'txn-1',
              project_slug: 'project-1',
            }),
          ],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      mockSpansResponse(
        [makeSpan({exclusive_time: 1000}), makeSpan({exclusive_time: 500})],
        'project-1',
        'txn-1'
      );
      await tree.fetchNodeSubTree(true, tree.root.children[0]!.children[0]!, {
        api: new MockApiClient(),
        organization,
        preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
      });

      const cb = jest.fn();
      search('exclusive_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 2, value: tree.list[2]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
  });

  // TODO Abdullah Khan: Add eap span tests for self_time/exclusive_time
  describe('eap span', () => {
    it('text filter', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({op: 'db'}), makeEAPSpan({op: 'http'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('text filter with prefix', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({op: 'db'}), makeEAPSpan({op: 'http'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (milliseconds)', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({start_timestamp: 0, end_timestamp: 1}),
          makeEAPSpan({start_timestamp: 0, end_timestamp: 0.5}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.duration:>500ms', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (seconds)', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({start_timestamp: 0, end_timestamp: 1}),
          makeEAPSpan({start_timestamp: 0, end_timestamp: 0.5}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.duration:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.total_time', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({start_timestamp: 0, end_timestamp: 1}),
          makeEAPSpan({start_timestamp: 0, end_timestamp: 0.5}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.total_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('name filter', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({name: 'authentication'}), makeEAPSpan({name: 'database'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('name:authentication', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('name filter with prefix', async () => {
      const tree = TraceTree.FromTrace(
        [makeEAPSpan({name: 'authentication'}), makeEAPSpan({name: 'database'})],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('span.name:authentication', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('name free text search', async () => {
      const tree = TraceTree.FromTrace(
        [
          makeEAPSpan({name: 'user_authentication_service', op: 'http'}),
          makeEAPSpan({name: 'database_query', op: 'db'}),
        ],
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('authentication', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
  });

  describe('synthetic keys', () => {
    describe('has:', () => {
      it.each(['error', 'errors'])('%s (transaction)', async key => {
        const tree = TraceTree.FromTrace(
          {
            transactions: [
              makeTransaction({
                errors: [makeTraceError()],
              }),
              makeTransaction({errors: []}),
            ],
            orphan_errors: [],
          },
          {
            meta: null,
            replay: null,
            organization,
          }
        );
        tree.build();

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(2);
        expect(cb.mock.calls[0][0][0]).toEqual([
          {index: 0, value: tree.list[0]},
          {index: 1, value: tree.list[1]},
        ]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });
      it.each(['issue', 'issues'])('%s (error on transaction)', async key => {
        const tree = TraceTree.FromTrace(
          {
            transactions: [
              makeTransaction({
                errors: [makeTraceError()],
              }),
              makeTransaction({errors: []}),
            ],
            orphan_errors: [],
          },
          {
            meta: null,
            replay: null,
            organization,
          }
        );
        tree.build();

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(2);
        expect(cb.mock.calls[0][0][0]).toEqual([
          {index: 0, value: tree.list[0]},
          {index: 1, value: tree.list[1]},
        ]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });

      it.each(['issue', 'issues'])('%s (performance issue on transaction)', async key => {
        const tree = TraceTree.FromTrace(
          {
            transactions: [
              makeTransaction({
                performance_issues: [makeTracePerformanceIssue()],
              }),
              makeTransaction({errors: []}),
            ],
            orphan_errors: [],
          },
          {
            meta: null,
            replay: null,
            organization,
          }
        );
        tree.build();

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(2);
        expect(cb.mock.calls[0][0][0]).toEqual([
          {index: 0, value: tree.list[0]},
          {index: 1, value: tree.list[1]},
        ]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });
      it.each(['profile', 'profiles'])('%s (profile on transaction)', async key => {
        const tree = TraceTree.FromTrace(
          {
            transactions: [
              makeTransaction({
                profile_id: 'profile',
              }),
              makeTransaction({errors: []}),
            ],
            orphan_errors: [],
          },
          {
            meta: null,
            replay: null,
            organization,
          }
        );
        tree.build();

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(1);
        expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });
    });
  });

  describe('project aliases', () => {
    it('project -> project_slug', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [makeTransaction({project_slug: 'test_project'})],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );
      tree.build();

      const cb = jest.fn();
      search('project:test_project', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('project.name -> project_slug', async () => {
      const tree = TraceTree.FromTrace(
        {
          transactions: [makeTransaction({project_slug: 'test_project'})],
          orphan_errors: [],
        },
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const cb = jest.fn();
      search('project.name:test_project', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 1, value: tree.list[1]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
  });
});
