import {AiTraceSpanNodeFixture} from 'sentry-fixture/aiTraceSpanNode';

import {
  buildAiSpanTree,
  getDefaultExpanded,
  getTreeAncestors,
  getTreeDescendants,
  getVisibleTreeNodes,
} from './aiSpanTree';

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

function ids(treeNodes: Array<{node: {id: string}}>) {
  return treeNodes.map(treeNode => treeNode.node.id);
}

describe('aiSpanTree', () => {
  it('nests spans at every level and lists them depth-first', () => {
    const tree = buildAiSpanTree([lead, tool, child, childCall, leadCall]);

    expect(ids(tree.list)).toEqual(['lead', 'tool', 'child', 'child-call', 'lead-call']);
    expect(tree.list.map(treeNode => treeNode.depth)).toEqual([0, 1, 2, 3, 1]);
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

  it('nests a span under its closest ancestor in the list', () => {
    const tree = buildAiSpanTree([childCall, lead]);

    expect(ids(tree.roots)).toEqual(['lead']);
    expect(tree.byId.get('child-call')?.depth).toBe(1);
  });

  it('hides the children of collapsed nodes', () => {
    const tree = buildAiSpanTree([lead, tool, child, childCall]);

    expect(ids(getVisibleTreeNodes(tree, getDefaultExpanded(2)))).toEqual([
      'lead',
      'tool',
      'child',
    ]);
    expect(
      ids(getVisibleTreeNodes(tree, getDefaultExpanded(0, tree.byId.get('child-call'))))
    ).toEqual(['lead', 'tool', 'child', 'child-call']);
  });
});
