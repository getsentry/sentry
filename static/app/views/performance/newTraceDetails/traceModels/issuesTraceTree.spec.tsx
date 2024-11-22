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
  orphan_errors: new Array(20).fill(null).map(() => makeTraceError({})),
});

const traceWithSiblingCollapsedNodes = makeTrace({
  transactions: [
    makeTransaction({
      transaction: 'transaction 1',
      children: [
        makeTransaction({}),
        makeTransaction({}),
        makeTransaction({transaction: 'transaction 2', errors: [makeTraceError({})]}),
        makeTransaction({}),
      ],
    }),
    makeTransaction({transaction: 'transaction 3'}),
    makeTransaction({transaction: 'transaction 4'}),
  ],
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
    // has +100 issues at the end
    const tree = IssuesTraceTree.FromTrace(errorsOnlyTrace, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });

  it('collapses sibling collapsed nodes', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithSiblingCollapsedNodes, {
      meta: null,
      replay: null,
    });

    expect(tree.build().serialize()).toMatchSnapshot();
  });
});
