import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  makeEAPSpan,
  makeParentAutogroup,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {ParentAutogroupNode} from './parentAutogroupNode';

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

    it('should return undefined when both head and tail ids are undefined', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({event_id: undefined});
      const tailSpanValue = makeEAPSpan({event_id: undefined});

      const headNode = new EapSpanNode(null, headSpanValue, extra);
      const tailNode = new EapSpanNode(null, tailSpanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        headNode,
        tailNode
      );

      expect(node.id).toBeUndefined();
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

      expect(node.directChildren).toEqual([headNode]);
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

      expect(node.directChildren).toEqual([childNode]);
    });

    it('should compute autogroupedSegments correctly', () => {
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
      // Should be computed by computeCollapsedBarSpace utility
    });

    it('should cache autogroupedSegments', () => {
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
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
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

    it('should render waterfall row', () => {
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

    it('should render details', () => {
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

      const mockProps = {
        node: node as any,
        organization: OrganizationFixture(),
        onParentClick: jest.fn(),
        onTabScrollToNode: jest.fn(),
      } as unknown as TraceTreeNodeDetailsProps<any>;

      const result = node.renderDetails(mockProps);
      expect(result).toBeDefined();
    });
  });

  describe('matchById', () => {
    it('should match by head node id', () => {
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

      expect(node.matchById('head-span-id')).toBe(true);
      expect(node.matchById('different-id')).toBe(false);
    });

    it('should match by tail node id', () => {
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

      expect(node.matchById('tail-span-id')).toBe(true);
      expect(node.matchById('different-id')).toBe(false);
    });

    it('should not match when neither head nor tail ids match', () => {
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

      expect(node.matchById('different-id')).toBe(false);
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by operation', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        autogrouped_by: {op: 'db.query'},
      });
      const headSpanValue = makeEAPSpan({
        event_id: 'head',
        op: 'db.query',
      });
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

    it('should match by description', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        description: 'SELECT * FROM users',
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

      expect(node.matchWithFreeText('SELECT')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('FROM')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match by name when available', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        name: 'custom-autogroup-name',
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

      expect(node.matchWithFreeText('custom')).toBe(true);
      expect(node.matchWithFreeText('autogroup')).toBe(true);
      expect(node.matchWithFreeText('name')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const headSpanValue = makeEAPSpan({
        event_id: 'head',
        op: undefined,
        description: undefined,
      });
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

      expect(node.matchWithFreeText('anything')).toBe(false);
    });

    it('should be case sensitive', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        description: 'GET /API/USERS',
        autogrouped_by: {
          op: 'HTTP.REQUEST',
        },
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

      expect(node.matchWithFreeText('HTTP')).toBe(true);
      expect(node.matchWithFreeText('http')).toBe(false);
      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('api')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle head and tail being the same node', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});
      const spanValue = makeEAPSpan({event_id: 'same'});

      const spanNode = new EapSpanNode(null, spanValue, extra);
      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        spanNode,
        spanNode // Same node as both head and tail
      );

      expect(node.head).toBe(spanNode);
      expect(node.tail).toBe(spanNode);
    });

    it('should handle complex autogroup chain', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({});

      // Create a longer chain
      const span1Value = makeEAPSpan({event_id: 'span1'});
      const span2Value = makeEAPSpan({event_id: 'span2'});
      const span3Value = makeEAPSpan({event_id: 'span3'});
      const span4Value = makeEAPSpan({event_id: 'span4'});

      const span1Node = new EapSpanNode(null, span1Value, extra);
      const span2Node = new EapSpanNode(span1Node, span2Value, extra);
      const span3Node = new EapSpanNode(span2Node, span3Value, extra);
      const span4Node = new EapSpanNode(span3Node, span4Value, extra);

      span1Node.children = [span2Node];
      span2Node.children = [span3Node];
      span3Node.children = [span4Node];

      const node = new ParentAutogroupNode(
        null,
        autogroupValue,
        extra,
        span1Node,
        span4Node
      );

      const segments = node.autogroupedSegments;
      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
    });

    it('should handle non-string name in value', () => {
      const extra = createMockExtra();
      const autogroupValue = makeParentAutogroup({
        name: 123 as any, // Non-string name
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

      expect(node.matchWithFreeText('123')).toBe(false); // Should not match non-string name
    });
  });
});
