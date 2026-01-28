import {
  makeAndOp,
  makeHeaderCheckOp,
  makeJsonPathOp,
  makeNotOp,
  makeOrOp,
  makeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/assertions/testUtils';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

import {AndOpTreeNode} from './andOpTreeNode';
import {HeaderCheckOpTreeNode} from './headerCheckOpTreeNode';
import {JsonPathOpTreeNode} from './jsonPathOpTreeNode';
import {NotOpTreeNode} from './notOpTreeNode';
import {OrOpTreeNode} from './orOpTreeNode';
import {StatusCodeOpTreeNode} from './statusCodeOpTreeNode';
import {Tree} from './tree';

describe('Assertion Failure Tree model', () => {
  it('FromAssertion builds the expected tree', () => {
    const leafStatus = makeStatusCodeOp({id: 'op-2', value: 200});
    const leafJson = makeJsonPathOp({id: 'op-4'});
    const leafHeader = makeHeaderCheckOp({id: 'op-7'});

    const orGroup = makeOrOp({id: 'op-3', children: [leafJson]});

    const innerAnd = makeAndOp({id: 'op-6', children: [leafHeader]});
    const notGroup = makeNotOp({id: 'op-5', operand: innerAnd});

    const rootAndOp = makeAndOp({id: 'op-1', children: [leafStatus, orGroup, notGroup]});
    const assertion: Assertion = {root: rootAndOp};

    const tree = Tree.FromAssertion(assertion);

    expect(tree.root).not.toBeNull();
    expect(tree.root).toBeInstanceOf(AndOpTreeNode);

    expect(tree.nodes.map(n => n.value.id)).toEqual([
      'op-1',
      'op-2',
      'op-3',
      'op-4',
      'op-5',
      'op-6',
      'op-7',
    ]);

    expect(tree.nodes[0]).toBeInstanceOf(AndOpTreeNode);
    expect(tree.nodes[1]).toBeInstanceOf(StatusCodeOpTreeNode);
    expect(tree.nodes[2]).toBeInstanceOf(OrOpTreeNode);
    expect(tree.nodes[3]).toBeInstanceOf(JsonPathOpTreeNode);
    expect(tree.nodes[4]).toBeInstanceOf(NotOpTreeNode);
    expect(tree.nodes[5]).toBeInstanceOf(AndOpTreeNode);
    expect(tree.nodes[6]).toBeInstanceOf(HeaderCheckOpTreeNode);

    // Testing hierarchy
    const root = tree.root;
    expect(root!.parent).toBeNull();
    expect(root!.children.map(n => n.value.id)).toEqual(['op-2', 'op-3', 'op-5']);

    const statusNode = tree.nodes[1];
    expect(statusNode!.parent).toBe(root);
    expect(statusNode!.children).toHaveLength(0);

    const orNode = tree.nodes[2];
    expect(orNode!.parent).toBe(root);
    expect(orNode!.children.map(n => n.value.id)).toEqual(['op-4']);

    const jsonNode = tree.nodes[3];
    expect(jsonNode!.parent).toBe(orNode);
    expect(jsonNode!.children).toHaveLength(0);

    const notNode = tree.nodes[4];
    expect(notNode!.parent).toBe(root);
    expect(notNode!.children.map(n => n.value.id)).toEqual(['op-6']);

    const innerAndNode = tree.nodes[5];
    expect(innerAndNode!.parent).toBe(notNode);
    expect(innerAndNode!.children.map(n => n.value.id)).toEqual(['op-7']);

    const headerNode = tree.nodes[6];
    expect(headerNode!.parent).toBe(innerAndNode);
    expect(headerNode!.children).toHaveLength(0);
  });
});
