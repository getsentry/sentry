import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

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
      expect(node.isEAPEvent).toBe(true);
      expect(node.searchPriority).toBe(1);
    });

    it('should initialize search priority for span', () => {
      const extra = createMockExtra();
      const value1 = makeEAPSpan({
        event_id: 'test-span-1',
        is_transaction: false,
      });
      const value2 = makeEAPSpan({
        event_id: 'test-span-2',
        is_transaction: true,
      });

      const node1 = new EapSpanNode(null, value1, extra);
      const node2 = new EapSpanNode(null, value2, extra);

      expect(node1.searchPriority).toBe(2);
      expect(node2.searchPriority).toBe(1);
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

    it('should reparent transaction under closest EAP transaction parent', () => {
      const extra = createMockExtra();
      const rootTransactionValue = makeEAPSpan({
        event_id: 'root-transaction',
        is_transaction: true,
        op: 'http.server',
      });
      const spanValue = makeEAPSpan({
        event_id: 'span-1',
        is_transaction: false,
        op: 'middleware',
      });
      const childTransactionValue = makeEAPSpan({
        event_id: 'child-transaction',
        is_transaction: true,
        op: 'rpc.call',
      });

      const rootTransaction = new EapSpanNode(null, rootTransactionValue, extra);
      const span = new EapSpanNode(rootTransaction, spanValue, extra);

      // Child transaction should be reparented under root transaction, not the span
      const childTransaction = new EapSpanNode(span, childTransactionValue, extra);

      expect(childTransaction.parent).toBe(rootTransaction);
      expect(rootTransaction.children).toContain(childTransaction);
    });

    it('should add itself to parent children and sort chronologically', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent',
        is_transaction: true,
        start_timestamp: 1000,
      });
      const child1Value = makeEAPSpan({
        event_id: 'child1',
        is_transaction: false,
        start_timestamp: 1002,
      });
      const child2Value = makeEAPSpan({
        event_id: 'child2',
        is_transaction: false,
        start_timestamp: 1001,
      });

      const parent = new EapSpanNode(null, parentValue, extra);
      const child1 = new EapSpanNode(parent, child1Value, extra);
      const child2 = new EapSpanNode(parent, child2Value, extra);

      // Children should be sorted by start timestamp
      expect(parent.children).toHaveLength(2);
      expect(parent.children[0]).toBe(child2); // Earlier timestamp
      expect(parent.children[1]).toBe(child1); // Later timestamp
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

    it('should not propagate errors/occurrences from transactions', () => {
      const extra = createMockExtra();
      const parentTransactionValue = makeEAPSpan({
        event_id: 'parent-transaction',
        is_transaction: true,
        errors: [],
        occurrences: [],
      });
      const childTransactionValue = makeEAPSpan({
        event_id: 'child-transaction',
        is_transaction: true,
        errors: [makeEAPError({issue_id: 1, event_id: 'error-1'})],
        occurrences: [makeEAPOccurrence({issue_id: 1, event_id: 'occurrence-1'})],
      });

      const parentTransaction = new EapSpanNode(null, parentTransactionValue, extra);
      const childTransaction = new EapSpanNode(
        parentTransaction,
        childTransactionValue,
        extra
      );

      // Transactions don't propagate their errors/occurrences to parent
      expect(parentTransaction.errors.size).toBe(0);
      expect(parentTransaction.occurrences.size).toBe(0);
      expect(childTransaction.errors.size).toBe(1);
      expect(childTransaction.occurrences.size).toBe(1);
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

  describe('description getter', () => {
    it('should return description when OTEL-friendly UI is disabled', () => {
      const extra = createMockExtra({
        organization: OrganizationFixture({features: []}),
      });
      const value = makeEAPSpan({
        description: 'GET /api/users',
        name: 'request-span',
      });

      const node = new EapSpanNode(null, value, extra);

      expect(node.description).toBe('GET /api/users');
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

      expect(parent.directVisibleChildren).toEqual([child]);
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
      expect(transaction.directVisibleChildren).toEqual([childTransaction]);
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

      expect(transaction.directVisibleChildren).toEqual([childTransaction, childSpan]);
    });
  });

  describe('visibleChildren override', () => {
    it('should show children for expanded spans', () => {
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
      parent.expanded = true;

      expect(parent.visibleChildren).toContain(child);
    });

    it('should show children for EAP transactions even when collapsed', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction',
        is_transaction: true,
      });
      const childValue = makeEAPSpan({
        event_id: 'child',
        is_transaction: true,
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const child = new EapSpanNode(transaction, childValue, extra);
      transaction.children = [child];
      transaction.expanded = false;

      // EAP transactions show children even when collapsed
      expect(transaction.visibleChildren).toContain(child);
    });

    it('should handle nested visible children correctly', () => {
      const extra = createMockExtra();
      const rootValue = makeEAPSpan({
        event_id: 'root',
        is_transaction: true,
      });
      const level1Value = makeEAPSpan({
        event_id: 'level1',
        is_transaction: true,
      });
      const level2Value = makeEAPSpan({
        event_id: 'level2',
        is_transaction: false,
      });

      const root = new EapSpanNode(null, rootValue, extra);
      const level1 = new EapSpanNode(root, level1Value, extra);
      const level2 = new EapSpanNode(level1, level2Value, extra);

      root.children = [level1];
      level1.children = [level2];
      root.expanded = false;
      level1.expanded = true;

      const visibleChildren = root.visibleChildren;
      expect(visibleChildren).toContain(level1);
      expect(visibleChildren).toContain(level2);
    });
  });

  describe('expand method', () => {
    const createMockTraceTree = () => ({
      list: [] as EapSpanNode[],
    });

    it('should handle expanding transaction with reparenting', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction',
        is_transaction: true,
        op: 'http.server',
      });
      const spanValue = makeEAPSpan({
        event_id: 'span',
        is_transaction: false,
        op: 'db.query',
      });
      const childTransactionValue = makeEAPSpan({
        event_id: 'child-transaction',
        is_transaction: true,
        parent_span_id: 'span',
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const span = new EapSpanNode(transaction, spanValue, extra);
      const childTransaction = new EapSpanNode(transaction, childTransactionValue, extra);

      transaction.children = [span, childTransaction];
      transaction.expanded = false;

      const tree = createMockTraceTree();
      tree.list = [transaction];

      const result = transaction.expand(true, tree as any);

      expect(result).toBe(true);
      expect(transaction.expanded).toBe(true);

      // Test that tree.list is updated to include visible children after expansion
      expect(tree.list).toContain(transaction);
      for (const child of transaction.visibleChildren) {
        expect(tree.list).toContain(child);
      }
      // The expanded node should be followed by its visible children in the list
      const transactionIndex = tree.list.indexOf(transaction);
      expect(
        tree.list.slice(
          transactionIndex + 1,
          transactionIndex + 1 + transaction.visibleChildren.length
        )
      ).toEqual(transaction.visibleChildren);
    });

    it('should handle collapsing transaction with reparenting', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction',
        is_transaction: true,
        op: 'http.server',
      });
      const spanValue = makeEAPSpan({
        event_id: 'span',
        is_transaction: false,
        op: 'db.query',
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      const span = new EapSpanNode(transaction, spanValue, extra);

      transaction.children = [span];
      transaction.expanded = true;

      const tree = createMockTraceTree();
      tree.list = [transaction, span];

      const result = transaction.expand(false, tree as any);

      expect(result).toBe(true);
      expect(transaction.expanded).toBe(false);

      // Test that tree.list is updated to include visible children after collapse
      expect(tree.list).toContain(transaction);
      for (const child of transaction.visibleChildren) {
        expect(tree.list).toContain(child);
      }
      // The collapsed node should be followed by its visible children in the list
      const transactionIndex = tree.list.indexOf(transaction);
      expect(
        tree.list.slice(
          transactionIndex + 1,
          transactionIndex + 1 + transaction.visibleChildren.length
        )
      ).toEqual(transaction.visibleChildren);
    });

    it('should return false when already in target state', () => {
      const extra = createMockExtra();
      const transactionValue = makeEAPSpan({
        event_id: 'transaction',
        is_transaction: true,
      });

      const transaction = new EapSpanNode(null, transactionValue, extra);
      transaction.expanded = true;

      const tree = createMockTraceTree();
      tree.list = [transaction];

      // Try to expand already expanded node
      const result = transaction.expand(true, tree as any);

      expect(result).toBe(false);
      expect(transaction.expanded).toBe(true);

      // tree.list should remain unchanged
      expect(tree.list).toEqual([transaction]);
    });
  });

  describe('makeBarColor', () => {
    it('should return operation-specific color', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'http.request',
      });

      const node = new EapSpanNode(null, value, extra);
      const mockTheme = ThemeFixture();

      const color = node.makeBarColor(mockTheme);
      expect(typeof color).toBe('string');
      expect(color).toBeDefined();
    });

    it('should handle undefined operation', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: undefined,
      });

      const node = new EapSpanNode(null, value, extra);
      const mockTheme = ThemeFixture();

      const color = node.makeBarColor(mockTheme);
      expect(typeof color).toBe('string');
      expect(color).toBeDefined();
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct matchByPath', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({event_id: 'spanId'});
      const node = new EapSpanNode(null, value, extra);

      expect(node.matchByPath('span-spanId')).toBe(true);
      expect(node.matchByPath('txn-spanId')).toBe(false);
    });

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

      expect(node.printNode()).toBe('http.request - unknown description');
    });

    it('should return correct printNode for transaction', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: 'http.server',
        description: 'GET /api/users',
        is_transaction: true,
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.printNode()).toBe('http.server - GET /api/users (eap-transaction)');
    });

    it('should return correct printNode with undefined op', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        op: undefined,
        description: 'Some description',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.printNode()).toBe('unknown span - Some description');
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
      const extra = createMockExtra({
        organization: OrganizationFixture({features: ['performance-otel-friendly-ui']}),
      });
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

    it('should handle empty children arrays', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: true,
        children: [],
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.children).toEqual([]);
      expect(node.directVisibleChildren).toEqual([]);
      expect(node.visibleChildren).toEqual([]);
    });
  });

  describe('resolveValueFromSearchKey', () => {
    it('should resolve duration aliases to span duration', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: false,
        start_timestamp: 1000,
        end_timestamp: 1500,
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.resolveValueFromSearchKey('duration')).toBe(500 * 1e3);
      expect(node.resolveValueFromSearchKey('span.duration')).toBe(500 * 1e3);
      expect(node.resolveValueFromSearchKey('span.total_time')).toBe(500 * 1e3);
    });

    it('should resolve span-prefixed keys to value properties', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: false,
        op: 'db.query',
        description: 'SELECT * FROM users',
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.resolveValueFromSearchKey('span.op')).toBe('db.query');
      expect(node.resolveValueFromSearchKey('span.description')).toBe(
        'SELECT * FROM users'
      );
    });

    it('should return null for unrecognized keys', () => {
      const extra = createMockExtra();
      const value = makeEAPSpan({
        event_id: 'test-span',
        is_transaction: false,
      });
      const node = new EapSpanNode(null, value, extra);

      expect(node.resolveValueFromSearchKey('unknown.key')).toBeNull();
      expect(node.resolveValueFromSearchKey('transaction.duration')).toBeNull();
    });
  });
});
