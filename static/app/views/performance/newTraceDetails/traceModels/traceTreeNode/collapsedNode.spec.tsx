import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

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
  });

  describe('abstract method implementations', () => {
    it('should return empty array for pathToNode', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      const path = node.pathToNode();
      expect(path).toEqual([]);
      expect(Array.isArray(path)).toBe(true);
      expect(path).toHaveLength(0);
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

    it('should render waterfall row', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      const mockProps = {
        node: node as any,
        theme: {} as any,
        organization: OrganizationFixture(),
        manager: {} as any,
        projects: [],
      } as unknown as TraceRowProps<any>;

      const result = node.renderWaterfallRow(mockProps);
      expect(result).toBeDefined();
    });

    it('should render null for details', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      const mockProps = {
        node: node as any,
        organization: OrganizationFixture(),
        onParentClick: jest.fn(),
        onTabScrollToNode: jest.fn(),
      } as unknown as TraceTreeNodeDetailsProps<any>;

      const result = node.renderDetails(mockProps);
      expect(result).toBeNull();
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

  describe('node behavior', () => {
    it('should inherit base node properties', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // Should have inherited properties from BaseNode
      expect(node.children).toEqual([]);
      expect(node.errors).toBeInstanceOf(Set);
      expect(node.occurrences).toBeInstanceOf(Set);
      expect(node.profiles).toBeInstanceOf(Set);
      expect(node.canFetchChildren).toBe(false);
      expect(node.fetchStatus).toBe('idle');
      expect(node.hasFetchedChildren).toBe(false);
      expect(node.canAutogroup).toBe(false);
      expect(node.allowNoInstrumentationNodes).toBe(false);
    });

    it('should handle space calculation from base node', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // CollapsedNode doesn't override space calculation, so should use base implementation
      expect(node.space).toEqual([0, 0]); // Default space from BaseNode
    });

    it('should handle children management', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();
      const childValue = makeEAPSpan({event_id: 'child'});

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);
      const childNode = new EapSpanNode(node, childValue, extra);

      // Can add children
      node.children.push(childNode);
      expect(node.children).toHaveLength(1);
      expect(node.children[0]).toBe(childNode);

      // Should inherit directChildren and visibleChildren behavior
      expect(node.directChildren).toEqual([childNode]);

      // Since expanded is false, visibleChildren should be empty
      expect(node.visibleChildren).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle null parent', () => {
      const extra = createMockExtra();
      const collapsedValue = createCollapsedNodeValue();

      // This should not typically happen, but test edge case
      const node = new CollapsedNode(null as any, collapsedValue, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(collapsedValue);
      expect(node.expanded).toBe(false);
    });

    it('should handle empty extra object', () => {
      const extra = createMockExtra({});
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.extra).toBe(extra);
      expect(node.extra.organization).toBeDefined();
    });

    it('should handle modified collapsed value', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue({
        type: 'collapsed',
        // Add any additional properties that might be on CollapsedNode
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      expect(node.value.type).toBe('collapsed');
    });

    it('should maintain consistent behavior across method calls', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // Multiple calls should return consistent results
      expect(node.printNode()).toBe('collapsed');
      expect(node.printNode()).toBe('collapsed');

      expect(node.analyticsName()).toBe('collapsed');
      expect(node.analyticsName()).toBe('collapsed');

      expect(node.drawerTabsTitle).toBe('Collapsed');
      expect(node.drawerTabsTitle).toBe('Collapsed');

      expect(node.pathToNode()).toEqual([]);
      expect(node.pathToNode()).toEqual([]);

      expect(node.matchWithFreeText('test')).toBe(false);
      expect(node.matchWithFreeText('test')).toBe(false);
    });

    it('should handle various input types for matchWithFreeText', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // Test various input types - should always return false
      expect(node.matchWithFreeText('a')).toBe(false);
      expect(node.matchWithFreeText('123')).toBe(false);
      expect(node.matchWithFreeText('special!@#$%^&*()characters')).toBe(false);
      expect(node.matchWithFreeText('very long search query with multiple words')).toBe(
        false
      );
      expect(node.matchWithFreeText('Unicode: 测试 中文')).toBe(false);
    });
  });
});
