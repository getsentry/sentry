import {IssuesTraceTree} from './issuesTraceTree';
import {makeTrace, makeTraceError, makeTransaction} from './traceTreeTestUtils';

const traceWithErrorInMiddle = makeTrace({
  transactions: [
    makeTransaction({transaction: 'transaction 1'}),
    makeTransaction({transaction: 'transaction 2'}),
    makeTransaction({transaction: 'transaction 3', errors: [makeTraceError({})]}),
    makeTransaction({transaction: 'transaction 4'}),
    makeTransaction({transaction: 'transaction 5'}),
  ],
});

const traceWithChildError = makeTrace({
  transactions: [
    makeTransaction({transaction: 'transaction 1'}),
    makeTransaction({
      transaction: 'transaction 2',
      children: [makeTransaction({errors: [makeTraceError({})]})],
    }),
    makeTransaction({transaction: 'transaction 4'}),
  ],
});

const errorsOnlyTrace = makeTrace({
  transactions: [],
  orphan_errors: new Array(30).fill(null).map(() => makeTraceError({})),
});

describe('IssuesTraceTree', () => {
  it('collapsed nodes without errors', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('preserves path to child error', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithChildError, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('errors only', () => {
    const tree = IssuesTraceTree.FromTrace(errorsOnlyTrace, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });
});
