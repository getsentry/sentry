import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeParentAutogroup,
  makeSpan,
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {ParentAutogroupNode} from './parentAutogroupNode';
import {SpanNode} from './spanNode';
import {TransactionNode} from './transactionNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('ParentAutogroupNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'db.query'},
      });
      const headSpanValue = makeEAPSpan({
        event_id: 'head-span',
        op: 'db.query',
        start_timestamp: 1000,
        end_timestamp: 1100,
      });
      const tailSpanValue = makeEAPSpan({
        event_id: 'tail-span',
        op: 'db.query',
        start_timestamp: 1800,
        end_timestamp: 1900,
      });

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.parent).toBeNull();
      expect(node.value).toBe(autogroupValue);
      expect(node.extra).toBe(extra);
      expect(node.head).toBe(headNode);
      expect(node.tail).toBe(tailNode);
      expect(node.groupCount).toBe(0);
      expect(node.expanded).toBe(false);
    });

    it('should initialize with parent node', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
      });
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'http.request'},
      });
      const headSpanValue = makeEAPSpan({
        event_id: 'head-span',
        op: 'http.request',
      });
      const tailSpanValue = makeEAPSpan({
        event_id: 'tail-span',
        op: 'http.request',
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const headNode = new EapSpanNode(parentNode, headSpanValue, extra);
      const tailNode = new EapSpanNode(parentNode, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        parentNode,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.parent).toBe(parentNode);
    });

    it('should handle different autogroup operations', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'custom.operation'},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.value.autogrouped_by.op).toBe('custom.operation');
    });
  });

  describe('getter methods', () => {
    it('should return id from head node', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head-span-id'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail-span-id'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.id).toBe('head-span-id');
    });

    it('should return id from tail node when head id is undefined', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: undefined});
      const tailSpanValue = makeEAPSpan({event_id: 'tail-span-id'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.id).toBe('tail-span-id');
    });

    it('should return correct drawerTabsTitle', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'db.query'},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.drawerTabsTitle).toBe('Autogroup - db.query');
    });

    it('should return correct drawerTabsTitle without operation', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: ''},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.drawerTabsTitle).toBe('Autogroup');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        description: 'GET /api/users',
        autogrouped_by: {op: 'http.request'},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.request',
        subtitle: 'GET /api/users',
      });
    });

    it('should return fallback traceHeaderTitle when op is empty', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: ''},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace',
        subtitle: undefined,
      });
    });

    it('should return head as directChildren when expanded', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      node.expanded = true;

      expect(node.directVisibleChildren).toEqual([headNode]);
    });

    it('should return tail children as directChildren when collapsed', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});
      const childSpanValue = makeEAPSpan({event_id: 'child'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const childNode = new EapSpanNode(tailNode, childSpanValue, extra);
      tailNode.children = [childNode];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      node.expanded = false;

      expect(node.directVisibleChildren).toEqual([childNode]);
    });

    it('should compute autogroupedSegments correctly with node chain', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});

      // Create a chain: head -> middle -> tail
      const headSpanValue = makeEAPSpan({
        event_id: 'head',
        start_timestamp: 1000,
        end_timestamp: 1100,
      });
      const middleSpanValue = makeEAPSpan({
        event_id: 'middle',
        start_timestamp: 1200,
        end_timestamp: 1300,
      });
      const tailSpanValue = makeEAPSpan({
        event_id: 'tail',
        start_timestamp: 1400,
        end_timestamp: 1500,
      });

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const middleNode = new EapSpanNode(headNode, middleSpanValue, extra);
      const tailNode = new EapSpanNode(middleNode, tailSpanValue, extra);

      headNode.children = [middleNode];
      middleNode.children = [tailNode];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const segments = node.autogroupedSegments;
      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      // Should include all nodes from head to tail
    });

    it('should cache autogroupedSegments for performance', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      headNode.children = [tailNode];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const segments1 = node.autogroupedSegments;
      const segments2 = node.autogroupedSegments;

      expect(segments1).toBe(segments2); // Should return the same cached instance
    });

    it('should compute visibleChildren differently based on expanded state', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});
      const childSpanValue = makeEAPSpan({event_id: 'child'});
      const grandchildSpanValue = makeEAPSpan({event_id: 'grandchild'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const childNode = new EapSpanNode(tailNode, childSpanValue, extra);
      const grandchildNode = new EapSpanNode(childNode, grandchildSpanValue, extra);

      tailNode.children = [childNode];
      childNode.children = [grandchildNode];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      // When collapsed, should return tail's children and their descendants
      node.expanded = false;
      const collapsedVisible = node.visibleChildren;
      expect(collapsedVisible).toContain(childNode);
      expect(collapsedVisible).toContain(grandchildNode);

      // When expanded, should return head and its descendants
      node.expanded = true;
      const expandedVisible = node.visibleChildren;
      expect(expandedVisible).toContain(headNode);
    });
  });

  describe('expand functionality', () => {
    const createMockTraceTree = (): TraceTree =>
      ({
        list: [] as any[],
      }) as TraceTree;

    it('should expand and add head and its visible children to tree list', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});
      const childSpanValue = makeEAPSpan({event_id: 'child'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const childNode = new EapSpanNode(tailNode, childSpanValue, extra);

      tailNode.children = [childNode];
      childNode.parent = tailNode; // Set initial parent

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const tree = createMockTraceTree();
      tree.list = [node as any];

      node.expanded = false; // Start collapsed
      const result = node.expand(true, tree);

      expect(result).toBe(true);
      expect(node.expanded).toBe(true);

      // Should reparent tail children to tail node
      expect(childNode.parent).toBe(tailNode);

      // Tree list should include head and its visible children
      expect(tree.list).toContain(headNode);
    });

    it('should collapse and reparent tail children to autogroup node', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});
      const childSpanValue = makeEAPSpan({event_id: 'child'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const childNode = new EapSpanNode(tailNode, childSpanValue, extra);

      tailNode.children = [childNode];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const tree = createMockTraceTree();
      tree.list = [node as any];

      node.expanded = true; // Start expanded
      const result = node.expand(false, tree);

      expect(result).toBe(true);
      expect(node.expanded).toBe(false);

      // Should reparent tail children to autogroup node
      expect(childNode.parent).toBe(node);

      // Tree list should include tail's visible children
      expect(tree.list).toContain(childNode);
    });

    it('should return false when already in target expanded state', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const tree = createMockTraceTree();

      node.expanded = true;
      const result1 = node.expand(true, tree);

      expect(result1).toBe(false);
      expect(node.expanded).toBe(true);

      node.expanded = false;
      const result2 = node.expand(false, tree);

      expect(result2).toBe(false);
      expect(node.expanded).toBe(false);
    });

    it('should return false when node has fetched children', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const tree = createMockTraceTree();

      node.hasFetchedChildren = true;
      node.expanded = false;

      const result = node.expand(true, tree);

      expect(result).toBe(false);
      expect(node.expanded).toBe(false);
    });

    it('should handle expand/collapse when node not in tree list', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});
      const childSpanValue = makeEAPSpan({event_id: 'child'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const childNode = new EapSpanNode(tailNode, childSpanValue, extra);

      tailNode.children = [childNode];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const tree = createMockTraceTree();
      // Node is not in tree.list

      node.expanded = false;
      const result = node.expand(true, tree);

      expect(result).toBe(true);
      expect(node.expanded).toBe(true);
      // Should still reparent children even when not in list
      expect(childNode.parent).toBe(tailNode);
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode without transaction parent', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head-span-id'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail-span-id'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const path = node.pathToNode();
      expect(path).toHaveLength(1);
      expect(path[0]).toBe('ag-head-span-id'); // Should use head node id
    });

    it('should include transaction ID in pathToNode when transaction parent found', () => {
      const extra = createMockExtra();
      const transactionValue = makeTransaction({
        event_id: 'transaction-id',
        'transaction.op': 'navigation',
      });
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeSpan({span_id: 'head-span-id'});
      const tailSpanValue = makeSpan({span_id: 'tail-span-id'});

      const transactionNode = new TransactionNode(null, transactionValue, extra);
      const headNode = new SpanNode(transactionNode, headSpanValue, extra);
      const tailNode = new SpanNode(transactionNode, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        transactionNode,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const path = node.pathToNode();
      expect(path).toHaveLength(2);
      expect(path[0]).toBe('ag-head-span-id');
      expect(path[1]).toBe('txn-transaction-id');
    });

    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.analyticsName()).toBe('parent autogroup');
    });

    it('should return correct printNode', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'custom.operation'},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.printNode()).toBe('parent autogroup (custom.operation: 0)');
    });
  });

  describe('match', () => {
    it('should match by path', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'headSpanId'});
      const tailSpanValue = makeEAPSpan({event_id: 'tailSpanId'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.matchByPath('ag-headSpanId')).toBe(true);
      expect(node.matchByPath('ag-differentId')).toBe(false);
    });

    it('should not match by ID', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head-span-id'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail-span-id'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.matchById('head-span-id')).toBe(false);
      expect(node.matchById('tail-span-id')).toBe(false);
      expect(node.matchById('different-id')).toBe(false);
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by operation', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'db.query'},
      });
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.matchWithFreeText('db')).toBe(true);
      expect(node.matchWithFreeText('query')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('should return red color when errors are present', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      // Add an error to trigger red color
      const mockError = makeTraceError({event_id: 'error-1', level: 'error'});
      node.errors.add(mockError);

      const theme = ThemeFixture();
      expect(node.makeBarColor(theme)).toBe(theme.tokens.graphics.danger.vibrant);
    });

    it('should return blue color when no errors are present', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      // No errors added, should default to blue
      const theme = ThemeFixture();
      expect(node.makeBarColor(theme)).toBe(theme.tokens.graphics.accent.vibrant);
    });
  });

  describe('getNextTraversalNodes', () => {
    it('should return head node for traversal', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: 'head'});
      const tailSpanValue = makeEAPSpan({event_id: 'tail'});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      const traversalNodes = node.getNextTraversalNodes();
      expect(traversalNodes).toEqual([headNode]);
    });
  });
});
