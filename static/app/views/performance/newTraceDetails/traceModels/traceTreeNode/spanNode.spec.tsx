import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  makeSpan,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {SpanNode} from './spanNode';
import {TransactionNode} from './transactionNode';

const mockOrganization = OrganizationFixture();
const mockExtra = {organization: mockOrganization};

describe('SpanNode', () => {
  describe('constructor', () => {
    it('initializes with basic span data', () => {
      const span = makeSpan({
        span_id: 'span-123',
        op: 'http.client',
        description: 'GET /api/data',
        start_timestamp: 1000,
        timestamp: 2000,
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.value).toBe(span);
      expect(node.canAutogroup).toBe(true);
      expect(node.allowNoInstrumentationNodes).toBe(true);
      expect(node.space).toEqual([1000 * 1e3, (2000 - 1000) * 1e3]);
    });

    it('handles null/undefined value gracefully', () => {
      const node = new SpanNode(null, null as any, mockExtra);

      expect(node.value).toBeNull();
      expect(node.canAutogroup).toBe(true);
      expect(node.allowNoInstrumentationNodes).toBe(true);
      expect(node.space).toEqual([0, 0]); // Default space from BaseNode
    });

    it('sets correct space when value is provided', () => {
      const span = makeSpan({
        start_timestamp: 1500,
        timestamp: 2500,
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.space).toEqual([1500 * 1e3, (2500 - 1500) * 1e3]);
    });
  });

  describe('getter methods', () => {
    let node: SpanNode;

    beforeEach(() => {
      const span = makeSpan({
        span_id: 'test-span-id',
        op: 'db.query',
        description: 'SELECT * FROM users',
        start_timestamp: 1500,
        timestamp: 2500,
      });

      node = new SpanNode(null, span, mockExtra);
    });

    it('returns correct id', () => {
      expect(node.id).toBe('test-span-id');
    });

    it('returns correct description', () => {
      expect(node.description).toBe('SELECT * FROM users');
    });

    it('returns correct startTimestamp', () => {
      expect(node.startTimestamp).toBe(1500);
    });

    it('returns correct endTimestamp', () => {
      expect(node.endTimestamp).toBe(2500);
    });

    it('handles undefined description', () => {
      node.value.description = undefined;
      expect(node.description).toBeUndefined();
    });
  });

  describe('drawerTabsTitle', () => {
    it('returns title with op and description', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.drawerTabsTitle).toBe('http.client - GET /api/users');
    });

    it('returns title with op only when no description', () => {
      const span = makeSpan({
        op: 'db.query',
        description: undefined,
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.drawerTabsTitle).toBe('db.query');
    });

    it('handles empty description', () => {
      const span = makeSpan({
        op: 'cache.get',
        description: '',
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.drawerTabsTitle).toBe('cache.get');
    });
  });

  describe('traceHeaderTitle', () => {
    it('returns correct title and subtitle', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'POST /api/submit',
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.client',
        subtitle: 'POST /api/submit',
      });
    });

    it('returns fallback title when op is missing', () => {
      const span = makeSpan({
        op: '',
        description: 'Some description',
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.traceHeaderTitle.title).toBe('Trace');
      expect(node.traceHeaderTitle.subtitle).toBe('Some description');
    });

    it('handles undefined op and description', () => {
      const span = makeSpan({
        op: undefined as any,
        description: undefined,
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.traceHeaderTitle.title).toBe('Trace');
      expect(node.traceHeaderTitle.subtitle).toBeUndefined();
    });
  });

  describe('pathToNode', () => {
    it('returns path with transaction and span id', () => {
      // Create a transaction parent
      const transaction = makeTransaction({
        event_id: 'txn-abc-123',
      });
      const transactionNode = new TransactionNode(null, transaction, mockExtra);

      const span = makeSpan({
        span_id: 'span-def-456',
      });
      const spanNode = new SpanNode(transactionNode as any, span, mockExtra);

      // Mock the ParentTransaction function by setting up the tree structure
      spanNode.parent = transactionNode as any;
      transactionNode.children.push(spanNode as any);

      const path = spanNode.pathToNode();

      expect(path).toEqual(['txn-txn-abc-123', 'span-span-def-456']);
    });

    it('returns path with only span id when no parent transaction', () => {
      const span = makeSpan({
        span_id: 'orphan-span-123',
      });
      const node = new SpanNode(null, span, mockExtra);

      const path = node.pathToNode();

      expect(path).toEqual(['span-orphan-span-123']);
    });
  });

  describe('analyticsName', () => {
    it('returns correct analytics name', () => {
      const span = makeSpan();
      const node = new SpanNode(null, span, mockExtra);

      expect(node.analyticsName()).toBe('span');
    });
  });

  describe('printNode', () => {
    it('prints node with op and description', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('http.client - GET /api/users');
    });

    it('handles missing op', () => {
      const span = makeSpan({
        op: undefined as any,
        description: 'Some description',
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('unknown span - Some description');
    });

    it('handles missing description', () => {
      const span = makeSpan({
        op: 'db.query',
        description: undefined,
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('db.query - unknown description');
    });

    it('handles both missing', () => {
      const span = makeSpan({
        op: undefined as any,
        description: undefined,
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('unknown span - unknown description');
    });

    it('adds prefetch prefix when http.request.prefetch is true', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /prefetch-data',
        data: {
          'http.request.prefetch': true,
        },
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('http.client - (prefetch) GET /prefetch-data');
    });

    it('does not add prefetch prefix when http.request.prefetch is false', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /normal-data',
        data: {
          'http.request.prefetch': false,
        },
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('http.client - GET /normal-data');
    });

    it('does not add prefetch prefix when data is missing', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /normal-data',
        data: {},
      });

      const node = new SpanNode(null, span, mockExtra);

      expect(node.printNode()).toBe('http.client - GET /normal-data');
    });
  });

  describe('matchWithFreeText', () => {
    let node: SpanNode;

    beforeEach(() => {
      const span = makeSpan({
        span_id: 'span-abc-123',
        op: 'http.client',
        description: 'GET /api/users/profile',
      });

      node = new SpanNode(null, span, mockExtra);
    });

    it('matches by op substring', () => {
      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('client')).toBe(true);
    });

    it('matches by description substring', () => {
      expect(node.matchWithFreeText('GET')).toBe(true);
      expect(node.matchWithFreeText('api')).toBe(true);
      expect(node.matchWithFreeText('users')).toBe(true);
      expect(node.matchWithFreeText('profile')).toBe(true);
    });

    it('matches by exact span id', () => {
      expect(node.matchWithFreeText('span-abc-123')).toBe(true);
    });

    it('does not match unrelated text', () => {
      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });

    it('handles missing op gracefully', () => {
      node.value.op = undefined as any;
      expect(node.matchWithFreeText('http')).toBe(false);
    });

    it('handles missing description gracefully', () => {
      node.value.description = undefined;
      expect(node.matchWithFreeText('GET')).toBe(false);
    });

    it('is case sensitive', () => {
      expect(node.matchWithFreeText('HTTP')).toBe(false);
      expect(node.matchWithFreeText('get')).toBe(false);
    });
  });
});
