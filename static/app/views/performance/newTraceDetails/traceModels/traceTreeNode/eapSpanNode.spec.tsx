import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('EapSpanNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties for transaction', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-transaction',
        is_transaction: true,
        op: 'http.server',
        description: 'GET /api/users',
      });

      const node = new EapSpanNode(null, value, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(value);
      expect(node.extra).toBe(extra);
      expect(node.expanded).toBe(false); // transactions start collapsed
      expect(node.canAutogroup).toBe(false);
      expect(node.allowNoInstrumentationNodes).toBe(false);
      expect(node.opsBreakdown).toEqual([]);
    });

    it('should initialize with basic properties for span', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: false,
        op: 'db.query',
        description: 'SELECT * FROM users',
      });

      const node = new EapSpanNode(null, value, extra);

      expect(node.parent).toBeNull();
      expect(node.value).toBe(value);
      expect(node.extra).toBe(extra);
      expect(node.expanded).toBe(true); // spans start expanded
      expect(node.canAutogroup).toBe(true);
      expect(node.allowNoInstrumentationNodes).toBe(true);
      expect(node.opsBreakdown).toEqual([]);
    });

    it('should reparent span under closest EAP transaction', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction-1',
        is_transaction: true,
        op: 'http.server',
      });
      const spanValue = makeEAPSpan({
        event_id: 'span-1',
        is_transaction: false,
        op: 'db.query',
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const span = new EapSpanNode(transaction, spanValue, extra);

      // The span should be reparented under the transaction
      expect(span.parent).toBe(transaction);
    });

    it('should propagate errors to closest EAP transaction', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction-1',
        is_transaction: true,
        errors: [],
      });
      const spanValue = makeEAPSpan({
        event_id: 'span-1',
        is_transaction: false,
        errors: [
          makeEAPError({issue_id: 1, event_id: 'error-1'}),
          makeEAPError({issue_id: 2, event_id: 'error-2'}),
        ],
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const span = new EapSpanNode(transaction, spanValue, extra);

      // Errors should be propagated to transaction
      expect(transaction.errors.size).toBe(2);
      expect(span.errors.size).toBe(2);
    });

    it('should propagate occurrences to closest EAP transaction', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction-1',
        is_transaction: true,
        occurrences: [],
      });
      const spanValue = makeEAPSpan({
        event_id: 'span-1',
        is_transaction: false,
        occurrences: [
          makeEAPOccurrence({issue_id: 1, event_id: 'occurrence-1'}),
          makeEAPOccurrence({issue_id: 2, event_id: 'occurrence-2'}),
        ],
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const span = new EapSpanNode(transaction, spanValue, extra);

      // Occurrences should be propagated to transaction
      expect(transaction.occurrences.size).toBe(2);
      expect(span.occurrences.size).toBe(2);
    });
  });

  describe('_updateAncestorOpsBreakdown', () => {
    it('should update ops breakdown for parent nodes', () => {
      const extra = createMockExtra();
      const grandparentValue = makeEAPSpan({
        event_id: 'grandparent',
        is_transaction: true,
        op: 'http.server',
      });
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: false,
        op: 'middleware',
      });
      const childValue = makeEAPSpan({
        event_id: 'child',
        is_transaction: false,
        op: 'db.query',
      });

      const grandparent = new EapSpanNode(null, grandparentValue, extra);
      const parent = new EapSpanNode(grandparent, parentValue, extra);
      const child = new EapSpanNode(parent, childValue, extra);

      // Check ops breakdown propagation
      expect(grandparent.opsBreakdown).toContainEqual({op: 'middleware', count: 1});
      expect(grandparent.opsBreakdown).toContainEqual({op: 'db.query', count: 1});
      expect(parent.opsBreakdown).toContainEqual({op: 'db.query', count: 1});
      expect(child.opsBreakdown).toEqual([]);
    });

    it('should increment count for duplicate operations', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
        op: 'http.server',
      });
      const child1Value = makeEAPSpan({
        event_id: 'child1',
        is_transaction: false,
        op: 'db.query',
      });
      const child2Value = makeEAPSpan({
        event_id: 'child2',
        is_transaction: false,
        op: 'db.query',
      });

      const parent = new EapSpanNode(null, parentValue, extra);
      const child1 = new EapSpanNode(parent, child1Value, extra);
      const child2 = new EapSpanNode(parent, child2Value, extra);

      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);

      // Should have one entry with count 2
      expect(parent.opsBreakdown).toHaveLength(1);
      expect(parent.opsBreakdown[0]).toEqual({op: 'db.query', count: 2});
    });
  });

  describe('getter methods', () => {
    it('should return correct drawerTabsTitle', () => {
      const extra = createMockExtra();
      const valueWithDescription = makeEAPSpan({
        op: 'http.request',
        description: 'GET /api/users',
      });
      const valueWithoutDescription = makeEAPSpan({
        op: 'http.request',
        description: undefined,
      });

      const nodeWithDescription = new EapSpanNode(null, valueWithDescription, extra);
      const nodeWithoutDescription = new EapSpanNode(
        null,
        valueWithoutDescription,
        extra
      );

      expect(nodeWithDescription.drawerTabsTitle).toBe('http.request - GET /api/users');
      expect(nodeWithoutDescription.drawerTabsTitle).toBe('http.request');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'http.server',
        transaction: 'GET /api/users',
      });

      const node = new EapSpanNode(null, value, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.server',
        subtitle: 'GET /api/users',
      });
    });

    it('should return correct traceHeaderTitle with fallback', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: undefined,
        transaction: 'GET /api/users',
      });

      const node = new EapSpanNode(null, value, extra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace',
        subtitle: 'GET /api/users',
      });
    });

    it('should return directChildren for non-transaction spans', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: false,
      });
      const childValue = makeEAPSpan({
        event_id: 'child',
        is_transaction: false,
      });

      const parent = new EapSpanNode(null, parentValue, extra);
      const child = new EapSpanNode(parent, childValue, extra);
      parent.children = [child];

      expect(parent.directChildren).toEqual([child]);
    });

    it('should filter directChildren for collapsed EAP transactions', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction',
        is_transaction: true,
      });
      const childTransactionValue = makeEAPSpan({
        event_id: 'child-transaction',
        is_transaction: true,
      });
      const childSpanValue = makeEAPSpan({
        event_id: 'child-span',
        is_transaction: false,
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const childTransaction = new EapSpanNode(transaction, childTransactionValue, extra);
      const childSpan = new EapSpanNode(transaction, childSpanValue, extra);

      transaction.children = [childTransaction, childSpan];
      transaction.expanded = false;

      // Should only return child transactions when collapsed
      expect(transaction.directChildren).toEqual([childTransaction]);
    });

    it('should return all children for expanded EAP transactions', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction',
        is_transaction: true,
      });
      const childTransactionValue = makeEAPSpan({
        event_id: 'child-transaction',
        is_transaction: true,
      });
      const childSpanValue = makeEAPSpan({
        event_id: 'child-span',
        is_transaction: false,
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const childTransaction = new EapSpanNode(transaction, childTransactionValue, extra);
      const childSpan = new EapSpanNode(transaction, childSpanValue, extra);

      transaction.children = [childTransaction, childSpan];
      transaction.expanded = true;

      expect(transaction.directChildren).toEqual([childTransaction, childSpan]);
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({event_id: 'test-span-id'});
      const node = new EapSpanNode(null, value, extra);

      expect(node.pathToNode()).toEqual(['span-test-span-id']);
    });

    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({});
      const node = new EapSpanNode(null, value, extra);

      expect(node.analyticsName()).toBe('eap span');
    });

    it('should return correct printNode with description', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'http.request',
        description: 'GET /api/users',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.printNode()).toBe('http.request - GET /api/users');
    });

    it('should return correct printNode without description', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'http.request',
        description: undefined,
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.printNode()).toBe('http.request');
    });

    it('should render waterfall row', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({});
      const node = new EapSpanNode(null, value, extra);

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
      const value = makeEAPSpan({});
      const node = new EapSpanNode(null, value, extra);

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
      const value = makeEAPSpan({
        op: 'http.request',
        description: 'GET /api/users',
        name: 'request-name',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('request')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match by description', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'db.query',
        description: 'SELECT * FROM users',
        name: 'query-name',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchWithFreeText('SELECT')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('FROM')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match by name', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'custom.op',
        description: 'Custom description',
        name: 'custom-span-name',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchWithFreeText('custom-span')).toBe(true);
      expect(node.matchWithFreeText('span-name')).toBe(true);
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('should match by event ID', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-event-id-123',
        op: 'http.request',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchWithFreeText('test-event-id-123')).toBe(true);
      expect(node.matchWithFreeText('different-id')).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: undefined,
        description: undefined,
        name: undefined,
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchWithFreeText('anything')).toBe(false);
    });

    it('should be case sensitive', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'HTTP.REQUEST',
        description: 'GET /API/USERS',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchWithFreeText('HTTP')).toBe(true);
      expect(node.matchWithFreeText('http')).toBe(false);
      expect(node.matchWithFreeText('API')).toBe(true);
      expect(node.matchWithFreeText('api')).toBe(false);
    });
  });

  describe('reparenting behavior', () => {
    it('should handle span without parent transaction', () => {
      const extra = createMockExtra();
      const spanValue = makeEAPSpan({
        event_id: 'orphan-span',
        is_transaction: false,
        op: 'db.query',
      });

      const span = new EapSpanNode(null, spanValue, extra);

      // Should not throw and should have null parent
      expect(span.parent).toBeNull();
    });

    it('should handle nested transactions correctly', () => {
      const extra = createMockExtra();
      const rootTransactionValue = makeEAPSpan({
        event_id: 'root-transaction',
        is_transaction: true,
        op: 'http.server',
      });
      const nestedTransactionValue = makeEAPSpan({
        event_id: 'nested-transaction',
        is_transaction: true,
        op: 'rpc.call',
      });
      const spanValue = makeEAPSpan({
        event_id: 'nested-span',
        is_transaction: false,
        op: 'db.query',
      });

      const rootTransaction = new EapSpanNode(null, rootTransactionValue, extra);
      const nestedTransaction = new EapSpanNode(
        rootTransaction,
        nestedTransactionValue,
        extra
      );
      const span = new EapSpanNode(nestedTransaction, spanValue, extra);

      // Span should be under the nested transaction
      expect(span.parent).toBe(nestedTransaction);
      expect(nestedTransaction.parent).toBe(rootTransaction);
    });
  });

  describe('edge cases', () => {
    it('should handle empty ops breakdown', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: true,
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.opsBreakdown).toEqual([]);
    });

    it('should handle missing operation in ops breakdown', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
        op: undefined,
      });
      const childValue = makeEAPSpan({
        event_id: 'child',
        is_transaction: false,
        op: undefined,
      });

      const parent = new EapSpanNode(null, parentValue, extra);
      const child = new EapSpanNode(parent, childValue, extra);

      expect(child.parent).toBe(parent);

      // Should handle undefined op gracefully
      expect(parent.opsBreakdown).toContainEqual({op: undefined, count: 1});
    });

    it('should handle empty children arrays', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: true,
        children: [],
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.children).toEqual([]);
      expect(node.directChildren).toEqual([]);
      expect(node.visibleChildren).toEqual([]);
    });
  });
});
