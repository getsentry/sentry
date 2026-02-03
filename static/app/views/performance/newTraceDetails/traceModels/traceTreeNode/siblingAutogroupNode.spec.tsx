import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  makeEAPSpan,
  makeSiblingAutogroup,
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {SiblingAutogroupNode} from './siblingAutogroupNode';
import {TransactionNode} from './transactionNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('SiblingAutogroupNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });

      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(parentNode, autogroupValue, extra);

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

      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      expect(node.value.autogrouped_by.op).toBe('custom.operation');
      expect(node.value.autogrouped_by.description).toBe('Custom operation description');
    });
  });

  describe('getter methods', () => {
    it('should return id from parent', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const parentSpanValue = makeEAPSpan({event_id: 'parent-1'});

      const parentNode = new EapSpanNode(null, parentSpanValue, extra);
      const node = new SiblingAutogroupNode(parentNode, autogroupValue, extra);

      expect(node.id).toBe('parent-1');
    });

    it('should return correct op from value', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operations',
        },
      });
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      node.children = [childNode];

      const segments1 = node.autogroupedSegments;
      const segments2 = node.autogroupedSegments;

      expect(segments1).toBe(segments2); // Should return the same cached instance
    });
  });

  describe('pathToNode', () => {
    it('should return path without transaction when no parent transaction found', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const parentSpanValue = makeEAPSpan({event_id: 'parent-span-id'});

      const parentNode = new EapSpanNode(null, parentSpanValue, extra);
      const node = new SiblingAutogroupNode(parentNode, autogroupValue, extra);

      const path = node.pathToNode();
      expect(path).toHaveLength(1);
      expect(path[0]).toBe('ag-parent-span-id'); // Should use parent id
    });

    it('should include transaction ID in path when closest transaction parent found', () => {
      const extra = createMockExtra();
      const transactionValue = makeTransaction({
        event_id: 'transaction-id',
        'transaction.op': 'navigation',
      });
      const autogroupValue = makeSiblingAutogroup({});

      const transactionNode = new TransactionNode(null, transactionValue, extra);
      const node = new SiblingAutogroupNode(transactionNode, autogroupValue, extra);

      const path = node.pathToNode();
      expect(path).toHaveLength(2);
      expect(path[0]).toBe('ag-transaction-id');
      expect(path[1]).toBe('txn-transaction-id');
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      expect(node.printNode()).toBe('sibling autogroup (custom.operation: 0)');
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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

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
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      expect(node.matchWithFreeText('SELECT')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should prioritize operation match over description', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'db.query',
          description: 'Database operation failed',
        },
      });
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      expect(node.matchWithFreeText('db')).toBe(true); // Should match operation
      expect(node.matchWithFreeText('Database')).toBe(true); // Should match description
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('should return red color when errors are present', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      // Add an error to trigger red color
      const mockError = makeTraceError({event_id: 'error-1', level: 'error'});
      node.errors.add(mockError);

      const theme = ThemeFixture();
      expect(node.makeBarColor(theme)).toBe(theme.tokens.graphics.danger.vibrant);
    });

    it('should return blue color when no errors are present', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      // No errors added, should default to blue
      const theme = ThemeFixture();
      expect(node.makeBarColor(theme)).toBe(theme.tokens.graphics.accent.vibrant);
    });
  });

  describe('groupCount functionality', () => {
    it('should handle groupCount updates in printNode output', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({
        autogrouped_by: {
          op: 'test.op',
          description: 'Test operation',
        },
      });
      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      // Initially 0
      expect(node.groupCount).toBe(0);
      expect(node.printNode()).toBe('sibling autogroup (test.op: 0)');

      // Update groupCount
      node.groupCount = 5;
      expect(node.printNode()).toBe('sibling autogroup (test.op: 5)');
    });
  });

  describe('match', () => {
    it('should match by path', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});
      const parentSpanValue = makeEAPSpan({event_id: 'parent1'});
      const parentNode = new EapSpanNode(null, parentSpanValue, extra);
      const node = new SiblingAutogroupNode(parentNode, autogroupValue, extra);

      expect(node.matchByPath('ag-parent1')).toBe(true);
      expect(node.matchByPath('span-differentId')).toBe(false);
    });

    it('should not match by ID', () => {
      const extra = createMockExtra();
      const autogroupValue = makeSiblingAutogroup({});

      const node = new SiblingAutogroupNode(null, autogroupValue, extra);

      // Create child nodes
      const child1Value = makeEAPSpan({event_id: 'child-1'});
      const child2Value = makeEAPSpan({event_id: 'child-2'});
      const child1 = new EapSpanNode(node, child1Value, extra);
      const child2 = new EapSpanNode(node, child2Value, extra);

      node.children = [child1, child2];

      expect(node.matchById('child-1')).toBe(false);
      expect(node.matchById('child-2')).toBe(false);
      expect(node.matchById('non-existent')).toBe(false);
    });
  });
});
