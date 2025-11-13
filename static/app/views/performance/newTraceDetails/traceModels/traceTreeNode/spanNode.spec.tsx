import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  makeEventTransaction,
  makeSpan,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {SpanNode} from './spanNode';
import {TransactionNode} from './transactionNode';

const createMockExtra = () => ({
  organization: OrganizationFixture(),
});

describe('SpanNode', () => {
  describe('constructor', () => {
    it('should initialize with span-specific properties', () => {
      const span = makeSpan({
        span_id: 'span-123',
        op: 'http.client',
        description: 'GET /api/data',
        start_timestamp: 1000,
        timestamp: 2000,
      });

      const node = new SpanNode(null, span, createMockExtra());

      expect(node.canAutogroup).toBe(true);
      expect(node.allowNoInstrumentationNodes).toBe(true);
      expect(node.space).toEqual([1000 * 1e3, (2000 - 1000) * 1e3]);
      expect(node.searchPriority).toBe(2);
    });

    it('should collapse Android HTTP client spans by default', () => {
      const span = makeSpan({
        op: 'http.client',
        origin: 'auto.http.okhttp',
      });

      const node = new SpanNode(null, span, createMockExtra());

      expect(node.expanded).toBe(false);
    });

    it('should expand non-Android HTTP client spans by default', () => {
      const span = makeSpan({
        op: 'http.client',
        origin: 'manual',
      });

      const node = new SpanNode(null, span, createMockExtra());

      expect(node.expanded).toBe(true);
    });
  });

  describe('getter methods', () => {
    it('should return span_id as id', () => {
      const span = makeSpan({
        span_id: 'test-span-id',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.id).toBe('test-span-id');
    });

    it('should return sdk_name as sdkName', () => {
      const span = makeSpan({
        span_id: 'test-span-id',
      });
      const node = new SpanNode(null, span, createMockExtra());
      const event = makeEventTransaction({
        sdk: {
          name: 'sentry.javascript.browser',
          version: '1.0.0',
        },
      });
      node.event = event;

      expect(node.sdkName).toBe('sentry.javascript.browser');
    });

    it('should return description from span', () => {
      const span = makeSpan({
        description: 'SELECT * FROM users',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.description).toBe('SELECT * FROM users');
    });

    it('should return timestamp as endTimestamp', () => {
      const span = makeSpan({
        timestamp: 2500,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.endTimestamp).toBe(2500);
    });

    it('should return start_timestamp as startTimestamp', () => {
      const span = makeSpan({
        start_timestamp: 1500,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.startTimestamp).toBe(1500);
    });
  });

  describe('drawerTabsTitle', () => {
    it('should combine op and description', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.drawerTabsTitle).toBe('http.client - GET /api/users');
    });

    it('should return op only when no description', () => {
      const span = makeSpan({
        op: 'db.query',
        description: undefined,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.drawerTabsTitle).toBe('db.query');
    });
  });

  describe('traceHeaderTitle', () => {
    it('should return op as title and description as subtitle', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'POST /api/submit',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.traceHeaderTitle).toEqual({
        title: 'http.client',
        subtitle: 'POST /api/submit',
      });
    });

    it('should return "Trace" as fallback title when op is missing', () => {
      const span = makeSpan({
        op: '',
        description: 'Some description',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.traceHeaderTitle.title).toBe('Trace');
      expect(node.traceHeaderTitle.subtitle).toBe('Some description');
    });
  });

  describe('makeBarColor', () => {
    it('should return color based on operation', () => {
      const span = makeSpan({
        op: 'http.client',
      });
      const node = new SpanNode(null, span, createMockExtra());

      const color = node.makeBarColor(ThemeFixture());

      expect(typeof color).toBe('string');
      expect(color).toBeDefined();
    });
  });

  describe('pathToNode', () => {
    it('should include transaction in path when parent transaction exists', () => {
      const transaction = makeTransaction({
        event_id: 'txn-abc-123',
      });
      const transactionNode = new TransactionNode(null, transaction, createMockExtra());

      const span = makeSpan({
        span_id: 'span-def-456',
      });
      const spanNode = new SpanNode(transactionNode, span, createMockExtra());

      const path = spanNode.pathToNode();

      expect(path).toEqual(['span-span-def-456', 'txn-txn-abc-123']);
    });

    it('should return only span path when no parent transaction', () => {
      const span = makeSpan({
        span_id: 'orphan-span-123',
      });
      const node = new SpanNode(null, span, createMockExtra());

      const path = node.pathToNode();

      expect(path).toEqual(['span-orphan-span-123']);
    });
  });

  describe('analyticsName', () => {
    it('should return "span"', () => {
      const span = makeSpan();
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.analyticsName()).toBe('span');
    });
  });

  describe('printNode', () => {
    it('should format with op and description', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.printNode()).toBe('http.client - GET /api/users');
    });

    it('should handle missing op with fallback', () => {
      const span = makeSpan({
        op: undefined as any,
        description: 'Some description',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.printNode()).toBe('unknown span - Some description');
    });

    it('should handle missing description with fallback', () => {
      const span = makeSpan({
        op: 'db.query',
        description: undefined,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.printNode()).toBe('db.query - unknown description');
    });

    it('should add prefetch prefix when data indicates prefetch', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /prefetch-data',
        data: {
          'http.request.prefetch': true,
        },
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.printNode()).toBe('http.client - (prefetch) GET /prefetch-data');
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by operation', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
        span_id: 'span-123',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.matchWithFreeText('http')).toBe(true);
      expect(node.matchWithFreeText('client')).toBe(true);
    });

    it('should match by description', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
        span_id: 'span-123',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.matchWithFreeText('GET')).toBe(true);
      expect(node.matchWithFreeText('api')).toBe(true);
    });

    it('should match by exact span ID', () => {
      const span = makeSpan({
        span_id: 'span-abc-123',
        op: 'http.client',
        description: 'GET /api/users',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.matchWithFreeText('span-abc-123')).toBe(true);
    });

    it('should not match unrelated text', () => {
      const span = makeSpan({
        op: 'http.client',
        description: 'GET /api/users',
        span_id: 'span-123',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.matchWithFreeText('nonexistent')).toBe(false);
    });
  });

  describe('abstract method implementations', () => {
    it('should implement matchByPath', () => {
      const span = makeSpan({
        span_id: '123',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.matchByPath('span-123')).toBe(true);
      expect(node.matchByPath('span-456')).toBe(false);
    });
  });

  describe('attributes getter', () => {
    it('should return span data as attributes', () => {
      const span = makeSpan({
        data: {
          'http.method': 'GET',
          'http.status_code': 200,
          'server.address': 'api.example.com',
        },
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.attributes).toEqual({
        'http.method': 'GET',
        'http.status_code': 200,
        'server.address': 'api.example.com',
      });
    });

    it('should return undefined when span has no data', () => {
      const span = makeSpan({
        data: undefined,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.attributes).toBeUndefined();
    });
  });

  describe('resolveValueFromSearchKey', () => {
    it('should resolve span.self_time to exclusive_time', () => {
      const span = makeSpan({
        exclusive_time: 150,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.resolveValueFromSearchKey('span.self_time')).toBe(150);
      expect(node.resolveValueFromSearchKey('span.exclusive_time')).toBe(150);
    });

    it('should resolve duration aliases to span duration', () => {
      const span = makeSpan({
        start_timestamp: 1000,
        timestamp: 1500,
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.resolveValueFromSearchKey('duration')).toBe(500 * 1e3);
      expect(node.resolveValueFromSearchKey('span.duration')).toBe(500 * 1e3);
      expect(node.resolveValueFromSearchKey('span.total_time')).toBe(500 * 1e3);
    });

    it('should resolve span-prefixed keys to value properties', () => {
      const span = makeSpan({
        op: 'db.query',
        description: 'SELECT * FROM users',
      });
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.resolveValueFromSearchKey('span.op')).toBe('db.query');
      expect(node.resolveValueFromSearchKey('span.description')).toBe(
        'SELECT * FROM users'
      );
    });

    it('should return null for unrecognized keys', () => {
      const span = makeSpan({});
      const node = new SpanNode(null, span, createMockExtra());

      expect(node.resolveValueFromSearchKey('unknown.key')).toBeNull();
      expect(node.resolveValueFromSearchKey('transaction.duration')).toBeNull();
    });
  });
});
