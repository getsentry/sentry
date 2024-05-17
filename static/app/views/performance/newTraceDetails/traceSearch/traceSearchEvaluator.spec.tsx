import {waitFor} from 'sentry-test/reactTestingLibrary';

import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {searchInTraceTreeTokens} from 'sentry/views/performance/newTraceDetails/traceSearch/traceSearchEvaluator';
import {parseTraceSearch} from 'sentry/views/performance/newTraceDetails/traceSearch/traceTokenConverter';

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

const makeTree = (list: TraceTree.NodeValue[]): TraceTree => {
  return {
    list: list.map(
      n => new TraceTreeNode(null, n, {project_slug: 'project', event_id: ''})
    ),
  } as unknown as TraceTree;
};

const search = (query: string, list: TraceTree.NodeValue[], cb: any) => {
  searchInTraceTreeTokens(
    makeTree(list),
    // @ts-expect-error test failed parse
    parseTraceSearch(query),
    null,
    cb
  );
};

describe('TraceSearchEvaluator', () => {
  it('empty string', async () => {
    const list = [
      makeTransaction({'transaction.op': 'operation'}),
      makeTransaction({'transaction.op': 'other'}),
    ];

    const cb = jest.fn();
    search('', list, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][0]).toEqual([]);
    expect(cb.mock.calls[0][0][1].size).toBe(0);
    expect(cb.mock.calls[0][0][2]).toBe(null);
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
    const list = [
      makeTransaction({'transaction.op': 'operation'}),
      makeTransaction({'transaction.op': 'other'}),
    ];

    const cb = jest.fn();
    search(query, list, cb);
    await waitFor(() => {
      expect(cb).toHaveBeenCalled();
    });
    expect(cb.mock.calls[0][0][0]).toEqual([]);
    expect(cb.mock.calls[0][0][1].size).toBe(0);
    expect(cb.mock.calls[0][0][2]).toBe(null);
  });
});
