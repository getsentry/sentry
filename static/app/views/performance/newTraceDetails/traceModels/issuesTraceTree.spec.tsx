import {OrganizationFixture} from 'sentry-fixture/organization';

import {IssuesTraceTree} from './issuesTraceTree';
import {makeEAPError, makeEAPSpan, makeEAPTrace} from './traceTreeTestUtils';

const traceWithErrorInMiddle = makeEAPTrace([
  makeEAPSpan({event_id: 'transaction-1', name: 'transaction 1'}),
  makeEAPSpan({event_id: 'transaction-2', name: 'transaction 2'}),
  makeEAPSpan({
    event_id: 'transaction-3',
    name: 'transaction 3',
    errors: [makeEAPError({event_id: 'error-3'})],
  }),
  makeEAPSpan({event_id: 'transaction-4', name: 'transaction 4'}),
  makeEAPSpan({event_id: 'transaction-5', name: 'transaction 5'}),
]);

const traceWithChildError = makeEAPTrace([
  makeEAPSpan({event_id: 'transaction-1', name: 'transaction 1'}),
  makeEAPSpan({
    event_id: 'transaction-2',
    name: 'transaction 2',
    children: [
      makeEAPSpan({
        event_id: 'transaction-4',
        errors: [makeEAPError({event_id: 'error-4'})],
      }),
    ],
  }),
  makeEAPSpan({event_id: 'transaction-5', name: 'transaction 5'}),
]);

const errorsOnlyTrace = makeEAPTrace(
  Array.from({length: 20}, (_, index) => makeEAPError({event_id: `error-${index}`}))
);

const organization = OrganizationFixture();

describe('IssuesTraceTree', () => {
  it('collapsed nodes without errors', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
      organization,
    });

    const issues = tree.root.children[0]!.findAllChildren(n => n.hasIssues);
    expect(tree.build().collapseList(issues, 3, 0).serialize()).toMatchSnapshot();
  });

  it('preserves path to child error', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithChildError, {
      meta: null,
      replay: null,
      organization,
    });

    const error = tree.root.children[0]!.findChild(n => n.hasIssues);

    let node = error;
    const nodes = [];
    while (node) {
      nodes.push(node);
      node = node.parent;
    }

    expect(tree.build().collapseList(nodes, 3, 0).serialize()).toMatchSnapshot();
  });

  it('errors only', () => {
    // has +100 issues at the end
    const tree = IssuesTraceTree.FromTrace(errorsOnlyTrace, {
      meta: null,
      replay: null,
      organization,
    });

    const errors = tree.root
      .findAllChildren(
        n =>
          n.hasIssues &&
          !!(n.value && 'event_type' in n.value && n.value.event_type === 'error')
      )
      .slice(0, 10);
    expect(tree.build().collapseList(errors, 3, 0).serialize()).toMatchSnapshot();
  });

  it('respects numSurroundingNodes parameter', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
      organization,
    });

    const issues = tree.root.children[0]!.findAllChildren(n => n.hasIssues);

    // Test with default value (3)
    const defaultCollapsed = tree.build().collapseList(issues, 3, 0).serialize();

    // Test with custom value (2)
    const customCollapsed = tree.build().collapseList(issues, 2, 0).serialize();

    expect(defaultCollapsed).toMatchSnapshot('default surrounding nodes (3)');
    expect(customCollapsed).toMatchSnapshot('custom surrounding nodes (2)');

    expect(defaultCollapsed).not.toEqual(customCollapsed);
  });

  it('respects minShownNodes parameter', () => {
    const tree = IssuesTraceTree.FromTrace(traceWithErrorInMiddle, {
      meta: null,
      replay: null,
      organization,
    });

    const issues = tree.root.children[0]!.findAllChildren(n => n.hasIssues);

    // Test with default minShownNodes value
    const defaultMinShown = tree.build().collapseList(issues, 0, 3).serialize();

    // Test with a smaller minShownNodes value
    const smallerMinShown = tree.build().collapseList(issues, 0, 0).serialize();

    expect(defaultMinShown).toMatchSnapshot('default minShownNodes (3)');
    expect(smallerMinShown).toMatchSnapshot('smaller minShownNodes (0)');
  });
});
