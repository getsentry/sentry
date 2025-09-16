import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  makeEAPSpan,
  makeSiblingAutogroup,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {SiblingAutogroupNode1} from './siblingAutogroupNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('SiblingAutogroupNode1', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(autogroupValue);
      expect(node.extra).toBe(extra);
      expect(node.groupCount).toBe(0);
      expect(node.expanded).toBe(false);
    });

    it('should initialize with parent node', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
      });
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'http.request',
          description: 'HTTP requests',
        },
      });

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const node = new SiblingAutogroupNode1(parentNode, autogroupValue, extra);

      expect(node.parent).toBe(parentNode);
    });

    it('should handle different autogroup operations and descriptions', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'custom.operation',
          description: 'Custom operation description',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.value.autogrouped_by.op).toBe('custom.operation');
      expect(node.value.autogrouped_by.description).toBe('Custom operation description');
    });
  });

  describe('getter methods', () => {
    it('should return id from first child', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const childSpanValue1 = makeEAPSpan({event_id: 'child-1'});
      const childSpanValue2 = makeEAPSpan({event_id: 'child-2'});

      const childNode1 = new EapSpanNode(null, childSpanValue1, extra);
      const childNode2 = new EapSpanNode(null, childSpanValue2, extra);
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = [childNode1, childNode2];

      expect(node.id).toBe('child-1');
    });

    it('should return undefined when no children', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.children).toEqual([]);
      expect(node.id).toBeUndefined();
    });

    it('should return correct op from value', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.op).toBe('db.query');
    });

    it('should return correct description from value', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'http.request',
          description: 'HTTP requests',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.description).toBe('HTTP requests');
    });

    it('should return correct drawerTabsTitle', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.drawerTabsTitle).toBe('Autogroup - db.query');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'http.request',
          description: 'GET /api/users',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.request',
        subtitle: 'GET /api/users',
      });
    });

    it('should return fallback traceHeaderTitle when op is empty', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: '',
          description: 'Some description',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace',
        subtitle: 'Some description',
      });
    });

    it('should compute autogroupedSegments correctly', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const childSpanValue1 = makeEAPSpan({
        event_id: 'child-1',
        start_timestamp: 1000,
        end_timestamp: 1100,
      });
      const childSpanValue2 = makeEAPSpan({
        event_id: 'child-2',
        start_timestamp: 1200,
        end_timestamp: 1300,
      });

      const childNode1 = new EapSpanNode(null, childSpanValue1, extra);
      const childNode2 = new EapSpanNode(null, childSpanValue2, extra);
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = [childNode1, childNode2];

      const segments = node.autogroupedSegments;
      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      // Should be computed by computeCollapsedBarSpace utility
    });

    it('should cache autogroupedSegments', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const childSpanValue = makeEAPSpan({event_id: 'child'});

      const childNode = new EapSpanNode(null, childSpanValue, extra);
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = [childNode];

      const segments1 = node.autogroupedSegments;
      const segments2 = node.autogroupedSegments;

      expect(segments1).toBe(segments2); // Should return the same cached instance
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const childSpanValue = makeEAPSpan({event_id: 'child-span-id'});

      const childNode = new EapSpanNode(null, childSpanValue, extra);
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = [childNode];

      const path = node.pathToNode();
      expect(path).toHaveLength(1);
      expect(path[0]).toBe('ag-child-span-id'); // Should use first child id
    });

    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.analyticsName()).toBe('sibling autogroup');
    });

    it('should return correct printNode', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'custom.operation',
          description: 'Custom description',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.printNode()).toBe('sibling autogroup (custom.operation: 0)');
    });

    it('should render waterfall row', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

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
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

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

  describe('matchWithFreeText', () => {
    it('should match by operation', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.matchWithFreeText('db')).toBe(true);
      expect(node.matchWithFreeText('query')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match by description', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'http.request',
          description: 'SELECT * FROM users',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.matchWithFreeText('SELECT')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('FROM')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match by name when available', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        name: 'custom-autogroup-name',
        autogrouped_by: {
          op: 'custom.op',
          description: 'Custom description',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.matchWithFreeText('custom')).toBe(true);
      expect(node.matchWithFreeText('autogroup')).toBe(true);
      expect(node.matchWithFreeText('name')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should be case sensitive', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'HTTP.REQUEST',
          description: 'GET /API/USERS',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.matchWithFreeText('HTTP')).toBe(true);
      expect(node.matchWithFreeText('http')).toBe(false);
      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('api')).toBe(false);
    });

    it('should handle non-string name in value', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        name: 123 as any, // Non-string name
        autogrouped_by: {
          op: 'test.op',
          description: 'Test description',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.matchWithFreeText('123')).toBe(false); // Should not match non-string name
    });
  });

  describe('edge cases', () => {
    it('should handle empty autogroup operation and description', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: '',
          description: '',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      expect(node.drawerTabsTitle).toBe('Autogroup - ');
      expect(node.printNode()).toBe('sibling autogroup (: 0)');
      expect(node.op).toBe('');
      expect(node.description).toBe('');
    });

    it('should handle multiple children for id getter', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const childSpanValue1 = makeEAPSpan({event_id: 'first-child'});
      const childSpanValue2 = makeEAPSpan({event_id: 'second-child'});
      const childSpanValue3 = makeEAPSpan({event_id: 'third-child'});

      const childNode1 = new EapSpanNode(null, childSpanValue1, extra);
      const childNode2 = new EapSpanNode(null, childSpanValue2, extra);
      const childNode3 = new EapSpanNode(null, childSpanValue3, extra);
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = [childNode1, childNode2, childNode3];

      // Should always return first child's id
      expect(node.id).toBe('first-child');
    });

    it('should handle children with undefined ids', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const childSpanValue = makeEAPSpan({event_id: undefined});

      const childNode = new EapSpanNode(null, childSpanValue, extra);
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = [childNode];

      expect(node.id).toBeUndefined();
    });

    it('should compute autogroupedSegments with no children', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      const segments = node.autogroupedSegments;
      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      expect(segments).toEqual([]); // Should be empty array when no children
    });

    it('should handle complex sibling groups', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Multiple database queries',
        },
      });

      // Create multiple sibling spans with different timestamps
      const spans = Array.from({length: 5}, (_, i) =>
        makeEAPSpan({
          event_id: `span-${i}`,
          start_timestamp: 1000 + i * 100,
          end_timestamp: 1050 + i * 100,
          op: 'db.query',
        })
      );

      const childNodes = spans.map(span => new EapSpanNode(null, span, extra));
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      node.children = childNodes;

      expect(node.id).toBe('span-0'); // First child's id
      expect(node.children).toHaveLength(5);

      const segments = node.autogroupedSegments;
      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
    });

    it('should handle groupCount updates', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'test.op',
          description: 'Test operation',
        },
      });
      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      // Initially 0
      expect(node.groupCount).toBe(0);
      expect(node.printNode()).toBe('sibling autogroup (test.op: 0)');

      // Update groupCount
      node.groupCount = 5;
      expect(node.printNode()).toBe('sibling autogroup (test.op: 5)');
    });
  });

  describe('matchById', () => {
    it('should match by first child ID', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      // Create child nodes
      const child1Value = makeEAPSpan({event_id: 'child-1'});
      const child2Value = makeEAPSpan({event_id: 'child-2'});
      const child1 = new EapSpanNode(node, child1Value, extra);
      const child2 = new EapSpanNode(node, child2Value, extra);

      node.children = [child1, child2];

      expect(node.matchById('child-1')).toBe(true);
      expect(node.matchById('child-2')).toBe(false); // Only matches first child
      expect(node.matchById('non-existent')).toBe(false);
    });

    it('should return false when no children exist', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'http.request',
          description: 'HTTP requests',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);
      expect(node.children).toEqual([]);

      expect(node.matchById('any-id')).toBe(false);
    });

    it('should return false when first child has no ID', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'custom.operation',
          description: 'Custom operations',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      // Create child with undefined ID
      const childValue = makeEAPSpan({event_id: undefined});
      const child = new EapSpanNode(node, childValue, extra);
      node.children = [child];

      expect(node.matchById('any-id')).toBe(false);
    });

    it('should handle empty string ID in first child', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'span.operation',
          description: 'Span operations',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      // Create child with empty string ID
      const childValue = makeEAPSpan({event_id: ''});
      const child = new EapSpanNode(node, childValue, extra);
      node.children = [child];

      expect(node.matchById('')).toBe(true);
      expect(node.matchById('any-id')).toBe(false);
    });

    it('should be case sensitive', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'test.operation',
          description: 'Test operations',
        },
      });

      const node = new SiblingAutogroupNode1(null, autogroupValue, extra);

      const childValue = makeEAPSpan({event_id: 'CaseSensitiveId'});
      const child = new EapSpanNode(node, childValue, extra);
      node.children = [child];

      expect(node.matchById('CaseSensitiveId')).toBe(true);
      expect(node.matchById('casesensitiveid')).toBe(false);
      expect(node.matchById('CASESENSITIVEID')).toBe(false);
    });
  });
});
