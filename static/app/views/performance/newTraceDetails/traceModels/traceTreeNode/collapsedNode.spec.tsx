import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTreeNodeExtra} from './baseNode';
import {CollapsedNode} from './collapsedNode';
import {EapSpanNode} from './eapSpanNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

const createCollapsedNodeValue = (
  overrides: Partial<TraceTree.CollapsedNode> = {}
): TraceTree.CollapsedNode => ({
  type: 'collapsed',
  ...overrides,
});

describe('CollapsedNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
      });
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.parent).toBe(parentNode);
      expect(node.value).toBe(collapsedValue);
      expect(node.extra).toBe(extra);
      expect(node.expanded).toBe(false);
    });

    it('should automatically add itself to parent children', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
      });
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const initialChildrenCount = parentNode.children.length;

      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(parentNode.children).toHaveLength(initialChildrenCount + 1);
      expect(parentNode.children).toContain(node);
      expect(parentNode.children[parentNode.children.length - 1]).toBe(node);
    });

    it('should handle different parent types', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'span-parent',
        is_transaction: false,
      });
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.parent).toBe(parentNode);
      expect(node.value.type).toBe('collapsed');
      expect(parentNode.children).toContain(node);
    });

    it('should call parent constructor with correct parameters', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
      });
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // Should inherit BaseNode properties
      expect(node.children).toEqual([]);
      expect(node.errors).toBeInstanceOf(Set);
      expect(node.occurrences).toBeInstanceOf(Set);
      expect(node.canFetchChildren).toBe(false);
      expect(node.fetchStatus).toBe('idle');
    });
  });

  describe('getter methods', () => {
    it('should return correct drawerTabsTitle', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.drawerTabsTitle).toBe('Collapsed');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Collapsed',
        subtitle: undefined,
      });
    });

    it('should return consistent results across multiple calls', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // Multiple calls should return the same results
      expect(node.drawerTabsTitle).toBe('Collapsed');
      expect(node.drawerTabsTitle).toBe('Collapsed');

      const title1 = node.traceHeaderTitle;
      const title2 = node.traceHeaderTitle;
      expect(title1).toEqual(title2);
      expect(title1.title).toBe('Collapsed');
      expect(title2.title).toBe('Collapsed');
    });
  });

  describe('abstract method implementations', () => {
    it('should return false for matchByPath', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.matchByPath('collapsed-parent')).toBe(false);
    });

    it('should return empty array for pathToNode', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      const path = node.pathToNode();
      expect(path).toHaveLength(1);
      expect(path[0]).toMatch(/^collapsed-.+/);
    });

    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.analyticsName()).toBe('collapsed');
    });

    it('should return correct printNode', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.printNode()).toBe('collapsed');
    });
  });

  describe('matchWithFreeText', () => {
    it('should always return false', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.matchWithFreeText('collapsed')).toBe(false);
      expect(node.matchWithFreeText('Collapsed')).toBe(false);
      expect(node.matchWithFreeText('anything')).toBe(false);
      expect(node.matchWithFreeText('')).toBe(false);
      expect(node.matchWithFreeText('test query')).toBe(false);
    });
  });
});
