import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TransactionNode} from './transactionNode';

const mockOrganization = OrganizationFixture();
const mockExtra = {organization: mockOrganization};
const theme = ThemeFixture();

describe('TransactionNode', () => {
  describe('constructor', () => {
    it('initializes with basic transaction data', () => {
      const transaction = makeTransaction({
        event_id: 'event-123',
        project_slug: 'my-project',
        'transaction.op': 'navigation',
        transaction: '/users/:id',
        start_timestamp: 1000,
        timestamp: 2000,
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.value).toBe(transaction);
      expect(node.canFetchChildren).toBe(true);
      expect(node.space).toEqual([1000 * 1e3, (2000 - 1000) * 1e3]);
    });

    it('handles performance issues in constructor', () => {
      const performanceIssue = makeTracePerformanceIssue({
        issue_short_id: 'PERF-123',
        event_id: 'perf-event-123',
      });

      const transaction = makeTransaction({
        performance_issues: [performanceIssue],
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.occurrences.has(performanceIssue)).toBe(true);
    });

    it('handles null/undefined value gracefully', () => {
      const node = new TransactionNode(null, null as any, mockExtra);

      expect(node.value).toBeNull();
      expect(node.canFetchChildren).toBe(true);
      expect(node.space).toEqual([0, 0]); // Default space from BaseNode
    });
  });

  describe('getter methods', () => {
    let node: TransactionNode;

    beforeEach(() => {
      const transaction = makeTransaction({
        event_id: 'test-event-id',
        project_slug: 'test-project',
        'transaction.op': 'http.server',
        transaction: '/api/users',
        start_timestamp: 1500,
        timestamp: 2500,
      });

      node = new TransactionNode(null, transaction, mockExtra);
    });

    it('returns correct id', () => {
      expect(node.id).toBe('test-event-id');
    });

    it('returns correct projectSlug', () => {
      expect(node.projectSlug).toBe('test-project');
    });

    it('returns correct op', () => {
      expect(node.op).toBe('http.server');
    });

    it('returns correct description', () => {
      expect(node.description).toBe('/api/users');
    });

    it('returns correct startTimestamp', () => {
      expect(node.startTimestamp).toBe(1500);
    });

    it('returns correct endTimestamp', () => {
      expect(node.endTimestamp).toBe(2500);
    });

    it('returns correct drawerTabsTitle with op and transaction', () => {
      expect(node.drawerTabsTitle).toBe('http.server - /api/users');
    });

    it('returns correct drawerTabsTitle with op only', () => {
      node.value.transaction = '';
      expect(node.drawerTabsTitle).toBe('http.server');
    });

    it('returns correct traceHeaderTitle', () => {
      expect(node.traceHeaderTitle).toEqual({
        title: 'http.server',
        subtitle: '/api/users',
      });
    });

    it('returns fallback title when op is missing', () => {
      node.value['transaction.op'] = '';
      expect(node.traceHeaderTitle.title).toBe('Trace');
    });
  });

  describe('matchById', () => {
    let node: TransactionNode;

    beforeEach(() => {
      const error = makeTraceError({event_id: 'error-123'});
      const performanceIssue = makeTracePerformanceIssue({event_id: 'perf-123'});

      const transaction = makeTransaction({
        event_id: 'txn-123',
        span_id: 'span-456',
        errors: [error],
        performance_issues: [performanceIssue],
      });

      node = new TransactionNode(null, transaction, mockExtra);
    });

    it('matches by event_id', () => {
      expect(node.matchById('txn-123')).toBe(true);
    });

    it('matches by span_id', () => {
      expect(node.matchById('span-456')).toBe(true);
    });

    it('matches by error event_id', () => {
      expect(node.matchById('error-123')).toBe(true);
    });

    it('matches by performance issue event_id', () => {
      expect(node.matchById('perf-123')).toBe(true);
    });

    it('does not match unrelated id', () => {
      expect(node.matchById('unrelated-id')).toBe(false);
    });
  });

  describe('matchWithFreeText', () => {
    let node: TransactionNode;

    beforeEach(() => {
      const transaction = makeTransaction({
        event_id: 'event-abc-123',
        'transaction.op': 'http.server',
        transaction: '/api/users/profile',
      });

      node = new TransactionNode(null, transaction, mockExtra);
    });

    it('matches by op substring', () => {
      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('server')).toBe(true);
    });

    it('matches by transaction substring', () => {
      expect(node.matchWithFreeText('api')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('profile')).toBe(true);
    });

    it('matches by exact event_id', () => {
      expect(node.matchWithFreeText('event-abc-123')).toBe(true);
    });

    it('does not match unrelated text', () => {
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('handles missing op gracefully', () => {
      node.value['transaction.op'] = undefined as any;
      expect(node.matchWithFreeText('http')).toBe(false);
    });

    it('handles missing transaction gracefully', () => {
      node.value.transaction = undefined as any;
      expect(node.matchWithFreeText('api')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('returns a color based on project and op', () => {
      const transaction = makeTransaction({
        project_slug: 'frontend',
        'transaction.op': 'navigation',
        sdk_name: 'javascript',
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      const color = node.makeBarColor(theme);
      expect(typeof color).toBe('string');
    });
  });

  describe('analyticsName', () => {
    it('returns correct analytics name', () => {
      const transaction = makeTransaction();
      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.analyticsName()).toBe('transaction');
    });
  });

  describe('pathToNode', () => {
    it('returns correct path array', () => {
      const transaction = makeTransaction({event_id: 'my-event-id'});
      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.pathToNode()).toEqual(['txn-my-event-id']);
    });
  });

  describe('printNode', () => {
    it('prints node with transaction and op', () => {
      const transaction = makeTransaction({
        transaction: 'GET /api/users',
        'transaction.op': 'http.server',
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.printNode()).toBe('GET /api/users - http.server');
    });

    it('handles missing transaction', () => {
      const transaction = makeTransaction({
        transaction: undefined as any,
        'transaction.op': 'http.server',
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.printNode()).toBe('unknown transaction - http.server');
    });

    it('handles missing op', () => {
      const transaction = makeTransaction({
        transaction: 'GET /api/users',
        'transaction.op': undefined as any,
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.printNode()).toBe('GET /api/users - unknown op');
    });

    it('handles both missing', () => {
      const transaction = makeTransaction({
        transaction: undefined as any,
        'transaction.op': undefined as any,
      });

      const node = new TransactionNode(null, transaction, mockExtra);

      expect(node.printNode()).toBe('unknown transaction - unknown op');
    });
  });
});
