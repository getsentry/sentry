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
      expect(node.profiles).toBeInstanceOf(Set);
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
      expect(path).toEqual([]);
      expect(Array.isArray(path)).toBe(true);
      expect(path).toHaveLength(0);
    });

    it('should return same empty array on multiple calls', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      const path1 = node.pathToNode();
      const path2 = node.pathToNode();

      expect(path1).toEqual([]);
      expect(path2).toEqual([]);
      // Each call should return a new array instance
      expect(path1).not.toBe(path2);
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

    it('should render TraceCollapsedRow component', () => {
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
        index: 0,
        style: {},
        traceSlug: 'test-slug',
      } as unknown as TraceRowProps<any>;

      const result = node.renderWaterfallRow(mockProps);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();

      // Should be a React element (TraceCollapsedRow)
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('type');
    });

    it('should pass correct props to TraceCollapsedRow', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      const mockProps = {
        node: node as any,
        theme: {blue300: '#blue'} as any,
        organization: OrganizationFixture(),
        manager: {get: jest.fn()} as any,
        projects: [{id: '1', name: 'test'}],
        index: 5,
        style: {height: 24},
        traceSlug: 'test-trace-slug',
      } as unknown as TraceRowProps<any>;

      const result = node.renderWaterfallRow(mockProps);

      // Should receive all props plus the node cast to LegacyCollapsedNode
      expect(result).toBeDefined();
      const props = (result as any).props;
      expect(props.node).toBe(node);
      expect(props.theme).toBe(mockProps.theme);
    });

    it('should render null for details consistently', () => {
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

      const result1 = node.renderDetails(mockProps);
      const result2 = node.renderDetails(mockProps);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result1).toBe(result2);
    });

    it('should ignore details props since it returns null', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({event_id: 'parent'});
      const collapsedValue = createCollapsedNodeValue();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new CollapsedNode(parentNode, collapsedValue, extra);

      // Test with various props - should always return null
      expect(node.renderDetails({} as any)).toBeNull();
      expect(node.renderDetails(null as any)).toBeNull();
      expect(node.renderDetails(undefined as any)).toBeNull();
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
