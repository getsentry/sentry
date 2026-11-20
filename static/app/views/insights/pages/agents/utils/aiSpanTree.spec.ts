import {AiTraceSpanNodeFixture} from 'sentry-fixture/aiTraceSpanNode';

import {
  buildAiSpanTree,
  getTreeAncestors,
  getTreeDescendants,
  getVisibleTreeNodes,
  getDefaultExpanded,
} from './aiSpanTree';

function ids(treeNodes: Array<{node: {id: string}}>) {
  return treeNodes.map(treeNode => treeNode.node.id);
}

describe('buildAiSpanTree', () => {
  const lead = AiTraceSpanNodeFixture({id: 'lead', operation: 'agent'});
  const tool = AiTraceSpanNodeFixture({id: 'tool', operation: 'tool', parent: lead});
  const child = AiTraceSpanNodeFixture({id: 'child', operation: 'agent', parent: tool});
  const childCall = AiTraceSpanNodeFixture({
    id: 'child-call',
    operation: 'ai_client',
    parent: child,
  });
  const leadCall = AiTraceSpanNodeFixture({
    id: 'lead-call',
    operation: 'ai_client',
    parent: lead,
  });

  it('nests spans at every level and lists them depth-first', () => {
    const tree = buildAiSpanTree([lead, tool, child, childCall, leadCall]);

    expect(ids(tree.roots)).toEqual(['lead']);
    expect(ids(tree.list)).toEqual(['lead', 'tool', 'child', 'child-call', 'lead-call']);
    expect(tree.list.map(treeNode => treeNode.depth)).toEqual([0, 1, 2, 3, 1]);
  });

  it('nests a span under its closest ancestor in the list', () => {
    const tree = buildAiSpanTree([lead, childCall]);

    expect(tree.byId.get('child-call')?.parent?.node.id).toBe('lead');
    expect(tree.byId.get('child-call')?.depth).toBe(1);
  });

  it('orders siblings with compareSiblings', () => {
    const tree = buildAiSpanTree([lead, tool, leadCall], {
      compareSiblings: (a, b) => b.id.localeCompare(a.id),
    });

    expect(ids(tree.list)).toEqual(['lead', 'tool', 'lead-call']);
  });

  it('makes a span without an ancestor in the list a root', () => {
    const tree = buildAiSpanTree([childCall, child, tool]);

    expect(ids(tree.roots)).toEqual(['tool']);
  });

  it('keeps spans whose parent links loop', () => {
    const agent = AiTraceSpanNodeFixture({id: 'agent', operation: 'agent'});
    const toolA = AiTraceSpanNodeFixture({id: 'tool-a', operation: 'tool'});
    const toolB = AiTraceSpanNodeFixture({id: 'tool-b', operation: 'tool'});
    // agent -> tool-a -> tool-b -> tool-a -> ...
    const parents = new Map([
      [agent, toolA],
      [toolA, toolB],
      [toolB, toolA],
    ]);
    for (const [node, parent] of parents) {
      node.findParent = ((predicate: (candidate: unknown) => boolean) => {
        let current = parent;
        while (current) {
          if (predicate(current)) {
            return current;
          }
          current = parents.get(current)!;
        }
        return null;
      }) as typeof node.findParent;
    }

    const tree = buildAiSpanTree([agent, toolA, toolB]);

    // Children keep their order in the list.
    expect(ids(tree.list)).toEqual(['tool-a', 'agent', 'tool-b']);
    expect(tree.list.map(treeNode => treeNode.depth)).toEqual([0, 1, 1]);
  });
});

describe('getVisibleTreeNodes', () => {
  const lead = AiTraceSpanNodeFixture({id: 'lead', operation: 'agent'});
  const tool = AiTraceSpanNodeFixture({id: 'tool', operation: 'tool', parent: lead});
  const child = AiTraceSpanNodeFixture({id: 'child', operation: 'agent', parent: tool});
  const childCall = AiTraceSpanNodeFixture({
    id: 'child-call',
    operation: 'ai_client',
    parent: child,
  });
  const tree = buildAiSpanTree([lead, tool, child, childCall]);

  it('hides the descendants of collapsed nodes', () => {
    expect(
      ids(getVisibleTreeNodes(tree, treeNode => treeNode.node.id !== 'tool'))
    ).toEqual(['lead', 'tool']);
  });

  it('expands by depth like maxDefaultDepth', () => {
    expect(ids(getVisibleTreeNodes(tree, getDefaultExpanded(2)))).toEqual([
      'lead',
      'tool',
      'child',
    ]);
  });

  it('finds ancestors and descendants', () => {
    expect(ids(getTreeAncestors(tree.byId.get('child-call')!))).toEqual([
      'child',
      'tool',
      'lead',
    ]);
    expect(ids(getTreeDescendants(tree.byId.get('tool')!))).toEqual([
      'child',
      'child-call',
    ]);
  });
});
