import {waitFor} from 'sentry-test/reactTestingLibrary';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';

import type {TraceTree} from '../traceModels/traceTree';
import {TraceTreeNode} from '../traceModels/traceTreeNode';
import {searchInTraceTreeTokens} from '../traceSearch/traceSearchEvaluator';
import {parseTraceSearch} from '../traceSearch/traceTokenConverter';

function makeTransaction(
  overrides: Partial<TraceTree.Transaction> = {}
): TraceTree.Transaction {
  return {
    children: [],
    start_timestamp: 0,
    timestamp: 1,
    transaction: 'transaction',
    'transaction.op': '',
    'transaction.status': '',
    performance_issues: [],
    errors: [],
    ...overrides,
  } as TraceTree.Transaction;
}

function makeSpan(overrides: Partial<RawSpanType> = {}): TraceTree.Span {
  return {
    span_id: '',
    op: '',
    description: '',
    start_timestamp: 0,
    timestamp: 10,
    data: {},
    trace_id: '',
    ...overrides,
  };
}

function makeError(overrides: Partial<TraceTree.TraceError> = {}): TraceTree.TraceError {
  return {
    issue_id: 1,
    issue: 'dead issue',
    event_id: 'event_id',
    project_slug: 'project',
    project_id: 1,
    level: 'fatal',
    title: 'dead',
    message: 'dead message',
    span: '1',
    ...overrides,
  };
}

function makePerformanceIssue(
  overrides: Partial<TraceTree.TracePerformanceIssue> = {}
): TraceTree.TracePerformanceIssue {
  return {
    event_id: 'event_id',
    project_slug: 'project',
    message: 'dead message',
    title: 'dead',
    issue_id: 1,
    level: 'fatal',
    project_id: 1,
    culprit: 'culprit',
    start: 0,
    end: 1,
    span: [],
    suspect_spans: [],
    type: 0,
    ...overrides,
  };
}

const makeTree = (list: TraceTree.NodeValue[]): TraceTree => {
  return {
    list: list.map(
      n => new TraceTreeNode(null, n, {project_slug: 'project', event_id: ''})
    ),
  } as unknown as TraceTree;
};

const search = (query: string, tree: TraceTree, cb: any) => {
  searchInTraceTreeTokens(
    tree,
    // @ts-expect-error dont care if this fails
    parseTraceSearch(query),
    null,
    cb
  );
};

describe('TraceSearchEvaluator', () => {
  it('empty string', async () => {
    const list = makeTree([
      makeTransaction({'transaction.op': 'operation'}),
      makeTransaction({'transaction.op': 'other'}),
    ]);

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
    const list = makeTree([
      makeTransaction({'transaction.op': 'operation'}),
      makeTransaction({'transaction.op': 'other'}),
    ]);

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
    const tree = makeTree([
      makeTransaction({'transaction.op': 'operation', transaction: 'something'}),
      makeTransaction({'transaction.op': 'other'}),
    ]);

    const cb = jest.fn();
    search('transaction.op:operation AND transaction:something', tree, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][1].size).toBe(1);
    expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  it('OR query', async () => {
    const tree = makeTree([
      makeTransaction({'transaction.op': 'operation'}),
      makeTransaction({'transaction.op': 'other'}),
    ]);

    const cb = jest.fn();
    search('transaction.op:operation OR transaction.op:other', tree, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][0]).toEqual([
      {index: 0, value: tree.list[0]},
      {index: 1, value: tree.list[1]},
    ]);
    expect(cb.mock.calls[0][0][1].size).toBe(2);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  it('OR with AND respects precedence', async () => {
    const tree = makeTree([
      makeTransaction({'transaction.op': 'operation', transaction: 'something'}),
      makeTransaction({'transaction.op': 'other', transaction: ''}),
    ]);

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
      {index: 0, value: tree.list[0]},
      {index: 1, value: tree.list[1]},
    ]);
    expect(cb.mock.calls[0][0][2]).toBeNull();
  });

  describe('transaction', () => {
    it('text filter', async () => {
      const tree = makeTree([
        makeTransaction({'transaction.op': 'operation'}),
        makeTransaction({'transaction.op': 'other'}),
      ]);

      const cb = jest.fn();
      search('transaction.op:operation', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('text filter with prefix', async () => {
      const tree = makeTree([makeTransaction({transaction: 'operation'})]);

      const cb = jest.fn();
      search('transaction.transaction:operation', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('transaction.duration (milliseconds)', async () => {
      const tree = makeTree([
        makeTransaction({'transaction.duration': 1000}),
        makeTransaction({'transaction.duration': 500}),
      ]);

      const cb = jest.fn();
      search('transaction.duration:>500ms', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('transaction.duration (seconds)', async () => {
      const tree = makeTree([
        makeTransaction({'transaction.duration': 1000}),
        makeTransaction({'transaction.duration': 500}),
      ]);

      const cb = jest.fn();
      search('transaction.duration:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('transaction.total_time', async () => {
      const tree = makeTree([
        makeTransaction({start_timestamp: 0, timestamp: 1}),
        makeTransaction({start_timestamp: 0, timestamp: 0.5}),
      ]);

      const cb = jest.fn();
      search('transaction.total_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    // For consistency between spans and txns, `transaction.self_time` should be implemented
  });

  describe('span', () => {
    it('text filter', async () => {
      const tree = makeTree([makeSpan({op: 'db'}), makeSpan({op: 'http'})]);

      const cb = jest.fn();
      search('op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('text filter with prefix', async () => {
      const tree = makeTree([makeSpan({op: 'db'}), makeSpan({op: 'http'})]);

      const cb = jest.fn();
      search('span.op:db', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (milliseconds)', async () => {
      const tree = makeTree([
        makeSpan({start_timestamp: 0, timestamp: 1}),
        makeSpan({start_timestamp: 0, timestamp: 0.5}),
      ]);

      const cb = jest.fn();
      search('span.duration:>500ms', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.duration (seconds)', async () => {
      const tree = makeTree([
        makeSpan({start_timestamp: 0, timestamp: 1}),
        makeSpan({start_timestamp: 0, timestamp: 0.5}),
      ]);

      const cb = jest.fn();
      search('span.duration:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });

    it('span.total_time', async () => {
      const tree = makeTree([
        makeSpan({start_timestamp: 0, timestamp: 1}),
        makeSpan({start_timestamp: 0, timestamp: 0.5}),
      ]);

      const cb = jest.fn();
      search('span.total_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('span.self_time', async () => {
      const tree = makeTree([
        makeSpan({exclusive_time: 1000}),
        makeSpan({exclusive_time: 500}),
      ]);

      const cb = jest.fn();
      search('span.self_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('span.exclusive_time', async () => {
      const tree = makeTree([
        makeSpan({exclusive_time: 1000}),
        makeSpan({exclusive_time: 500}),
      ]);

      const cb = jest.fn();
      search('span.exclusive_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('exclusive_time', async () => {
      const tree = makeTree([
        makeSpan({exclusive_time: 1000}),
        makeSpan({exclusive_time: 500}),
      ]);

      const cb = jest.fn();
      search('exclusive_time:>0.5s', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
  });

  describe('synthetic keys', () => {
    describe('has:', () => {
      it.each(['error', 'errors'])('%s (transaction)', async key => {
        const tree = makeTree([
          makeTransaction({
            errors: [makeError()],
          }),
          makeTransaction({errors: []}),
        ]);

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(1);
        expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });
      it.each(['issue', 'issues'])('%s (error on transaction)', async key => {
        const tree = makeTree([
          makeTransaction({
            errors: [makeError()],
          }),
          makeTransaction({errors: []}),
        ]);

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(1);
        expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });

      it.each(['issue', 'issues'])('%s (performance issue on transaction)', async key => {
        const tree = makeTree([
          makeTransaction({
            performance_issues: [makePerformanceIssue()],
          }),
          makeTransaction({errors: []}),
        ]);

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(1);
        expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });
      it.each(['profile', 'profiles'])('%s (profile on transaction)', async key => {
        const tree = makeTree([
          makeTransaction({
            profile_id: 'profile',
          }),
          makeTransaction({errors: []}),
        ]);

        const cb = jest.fn();
        search(`has:${key}`, tree, cb);
        await waitFor(() => expect(cb).toHaveBeenCalled());
        expect(cb.mock.calls[0][0][1].size).toBe(1);
        expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
        expect(cb.mock.calls[0][0][2]).toBeNull();
      });
    });
  });

  describe('project aliases', () => {
    it('project -> project_slug', async () => {
      const tree = makeTree([makeTransaction({project_slug: 'test_project'})]);

      const cb = jest.fn();
      search('project:test_project', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
    it('project.name -> project_slug', async () => {
      const tree = makeTree([makeTransaction({project_slug: 'test_project'})]);

      const cb = jest.fn();
      search('project.name:test_project', tree, cb);
      await waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.calls[0][0][1].size).toBe(1);
      expect(cb.mock.calls[0][0][0]).toEqual([{index: 0, value: tree.list[0]}]);
      expect(cb.mock.calls[0][0][2]).toBeNull();
    });
  });
});
