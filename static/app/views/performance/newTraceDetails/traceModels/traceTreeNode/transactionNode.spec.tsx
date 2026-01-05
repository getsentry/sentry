import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TransactionNode} from './transactionNode';

const createMockExtra = () => ({
  organization: OrganizationFixture(),
});

describe('TransactionNode', () => {
  describe('constructor', () => {
    it('should initialize with transaction-specific properties', () => {
      const transaction = makeTransaction({
        event_id: 'event-123',
        project_slug: 'my-project',
        'transaction.op': 'navigation',
        transaction: '/users/:id',
        start_timestamp: 1000,
        timestamp: 2000,
      });

      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.canFetchChildren).toBe(true);
      expect(node.space).toEqual([1000 * 1e3, (2000 - 1000) * 1e3]);
      expect(node.searchPriority).toBe(1);
    });

    it('should collect performance issues from transaction', () => {
      const performanceIssue = makeTracePerformanceIssue({
        issue_short_id: 'PERF-123',
        event_id: 'perf-event-123',
      });

      const transaction = makeTransaction({
        performance_issues: [performanceIssue],
      });

      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.occurrences.has(performanceIssue)).toBe(true);
    });

    it('should add itself to parent children and sort chronologically', () => {
      const parent = new TransactionNode(
        null,
        makeTransaction({start_timestamp: 1000}),
        createMockExtra()
      );

      const child = new TransactionNode(
        parent as any,
        makeTransaction({start_timestamp: 500}),
        createMockExtra()
      );

      expect(parent.children).toContain(child);
      expect(child.parent).toBe(parent);
    });
  });

  describe('getter methods', () => {
    it('should return event_id as id', () => {
      const transaction = makeTransaction({
        event_id: 'test-event-id',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.id).toBe('test-event-id');
    });

    it('should return project_slug as projectSlug', () => {
      const transaction = makeTransaction({
        project_slug: 'test-project',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.projectSlug).toBe('test-project');
    });

    it('should return transaction.op as op', () => {
      const transaction = makeTransaction({
        'transaction.op': 'http.server',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.op).toBe('http.server');
    });

    it('should return transaction as description', () => {
      const transaction = makeTransaction({
        transaction: '/api/users',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.description).toBe('/api/users');
    });

    it('should return start_timestamp as startTimestamp', () => {
      const transaction = makeTransaction({
        start_timestamp: 1500,
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.startTimestamp).toBe(1500);
    });

    it('should return timestamp as endTimestamp', () => {
      const transaction = makeTransaction({
        timestamp: 2500,
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.endTimestamp).toBe(2500);
    });
  });

  describe('drawerTabsTitle', () => {
    it('should combine op and transaction', () => {
      const transaction = makeTransaction({
        'transaction.op': 'http.server',
        transaction: '/api/users',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.drawerTabsTitle).toBe('http.server - /api/users');
    });

    it('should return op only when transaction is empty', () => {
      const transaction = makeTransaction({
        'transaction.op': 'http.server',
        transaction: '',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.drawerTabsTitle).toBe('http.server');
    });
  });

  describe('traceHeaderTitle', () => {
    it('should return op as title and transaction as subtitle', () => {
      const transaction = makeTransaction({
        'transaction.op': 'http.server',
        transaction: '/api/users',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.server',
        subtitle: '/api/users',
      });
    });

    it('should return "Trace" as fallback title when op is missing', () => {
      const transaction = makeTransaction({
        'transaction.op': '',
        transaction: '/api/users',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.traceHeaderTitle.title).toBe('Trace');
    });
  });

  describe('matchById', () => {
    it('should match by path', () => {
      const transaction = makeTransaction({
        event_id: '123',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchByPath('txn-123')).toBe(true);
      expect(node.matchByPath('txn-456')).toBe(false);
    });
    it('should match by event_id', () => {
      const transaction = makeTransaction({
        event_id: 'txn-123',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchById('txn-123')).toBe(true);
    });

    it('should match by span_id', () => {
      const transaction = makeTransaction({
        span_id: 'span-456',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchById('span-456')).toBe(true);
    });

    it('should match by error event_id', () => {
      const error = makeTraceError({event_id: 'error-123'});
      const transaction = makeTransaction({
        errors: [error],
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchById('error-123')).toBe(true);
    });

    it('should not match unrelated id', () => {
      const transaction = makeTransaction({
        event_id: 'txn-123',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchById('unrelated-id')).toBe(false);
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by operation', () => {
      const transaction = makeTransaction({
        'transaction.op': 'http.server',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('server')).toBe(true);
    });

    it('should match by transaction name', () => {
      const transaction = makeTransaction({
        transaction: '/api/users/profile',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchWithFreeText('api')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
    });

    it('should match by exact event_id', () => {
      const transaction = makeTransaction({
        event_id: 'event-abc-123',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchWithFreeText('event-abc-123')).toBe(true);
    });

    it('should not match unrelated text', () => {
      const transaction = makeTransaction({
        'transaction.op': 'http.server',
        transaction: '/api/users',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('should return color based on project and operation', () => {
      const transaction = makeTransaction({
        project_slug: 'frontend',
        'transaction.op': 'navigation',
        sdk_name: 'javascript',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      const color = node.makeBarColor(ThemeFixture());

      expect(typeof color).toBe('string');
      expect(color).toBeDefined();
    });
  });

  describe('expand', () => {
    it('should expand and collapse', () => {
      const transaction = makeTransaction();
      const node = new TransactionNode(null, transaction, createMockExtra());
      const child1 = new TransactionNode(
        node,
        makeTransaction({start_timestamp: 500, 'transaction.op': 'http.server'}),
        createMockExtra()
      );

      const mockTree = {
        list: [node, child1],
      };

      // Should be expanded by default
      expect(node.expanded).toBe(true);

      // Collapse
      const collapseResult = node.expand(false, mockTree as any);
      expect(collapseResult).toBe(true);
      expect(node.expanded).toBe(false);
      expect(mockTree.list).toHaveLength(1);
      expect(mockTree.list).toContain(node);

      // Expand
      const expandResult = node.expand(true, mockTree as any);
      expect(expandResult).toBe(true);
      expect(node.expanded).toBe(true);
      expect(mockTree.list).toHaveLength(2);
      expect(mockTree.list).toContain(node);
      expect(mockTree.list).toContain(child1);
    });

    it('should not expand when already expanded', () => {
      const transaction = makeTransaction();
      const node = new TransactionNode(null, transaction, createMockExtra());
      node.expanded = true;
      const mockTree = {list: [node]};

      const result = node.expand(true, mockTree as any);

      expect(result).toBe(false);
    });

    it('should not expand when hasFetchedChildren is true', () => {
      const transaction = makeTransaction();
      const node = new TransactionNode(null, transaction, createMockExtra());
      node.hasFetchedChildren = true;
      const mockTree = {list: [node]};

      const result = node.expand(true, mockTree as any);

      expect(result).toBe(false);
    });
  });

  describe('analyticsName', () => {
    it('should return "transaction"', () => {
      const transaction = makeTransaction();
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.analyticsName()).toBe('transaction');
    });
  });

  describe('pathToNode', () => {
    it('should return transaction path with event ID', () => {
      const transaction = makeTransaction({event_id: 'my-event-id'});
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.pathToNode()).toEqual(['txn-my-event-id']);
    });
  });

  describe('printNode', () => {
    it('should format with transaction and operation', () => {
      const transaction = makeTransaction({
        transaction: 'GET /api/users',
        'transaction.op': 'http.server',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.printNode()).toBe('GET /api/users - http.server');
    });

    it('should handle missing transaction with fallback', () => {
      const transaction = makeTransaction({
        transaction: undefined as any,
        'transaction.op': 'http.server',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.printNode()).toBe('unknown transaction - http.server');
    });

    it('should handle missing operation with fallback', () => {
      const transaction = makeTransaction({
        transaction: 'GET /api/users',
        'transaction.op': undefined as any,
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.printNode()).toBe('GET /api/users - unknown op');
    });
  });

  describe('resolveValueFromSearchKey', () => {
    it('should resolve duration aliases to transaction duration', () => {
      const transaction = makeTransaction({
        start_timestamp: 1000,
        timestamp: 2500,
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.resolveValueFromSearchKey('duration')).toBe(1500 * 1e3);
      expect(node.resolveValueFromSearchKey('transaction.total_time')).toBe(1500 * 1e3);
    });

    it('should resolve transaction-prefixed keys to value properties', () => {
      const transaction = makeTransaction({
        transaction: 'GET /api/users',
        project_slug: 'my-project',
      });
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.resolveValueFromSearchKey('transaction.project_slug')).toBe(
        'my-project'
      );
    });

    it('should return null for unrecognized keys', () => {
      const transaction = makeTransaction({});
      const node = new TransactionNode(null, transaction, createMockExtra());

      expect(node.resolveValueFromSearchKey('unknown.key')).toBeNull();
      expect(node.resolveValueFromSearchKey('span.duration')).toBeNull();
    });
  });
});
