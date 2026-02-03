import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeSpan,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {NoInstrumentationNode} from './noInstrumentationNode';
import {SpanNode} from './spanNode';
import {TransactionNode} from './transactionNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

const createMissingInstrumentationSpan = (
  overrides: Partial<TraceTree.MissingInstrumentationSpan> = {}
): TraceTree.MissingInstrumentationSpan => ({
  start_timestamp: 1000,
  timestamp: 2000,
  type: 'missing_instrumentation',
  ...overrides,
});

describe('NoInstrumentationNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous-span',
        start_timestamp: 1000,
        end_timestamp: 1500,
        op: 'db.query',
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span',
        start_timestamp: 2000,
        end_timestamp: 2500,
        op: 'http.request',
      });
      const missingInstrValue = createMissingInstrumentationSpan({
        start_timestamp: 1500,
        timestamp: 2000,
      });

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.previous).toBe(previousNode);
      expect(node.next).toBe(nextNode);
      expect(node.parent).toBeNull();
      expect(node.value).toBe(missingInstrValue);
      expect(node.extra).toBe(extra);
    });

    it('should calculate space correctly with previous and next timestamps', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous-span',
        start_timestamp: 1000,
        end_timestamp: 1500,
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span',
        start_timestamp: 2000,
        end_timestamp: 2500,
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      // Space should be [previous.endTimestamp * 1e3, (next.startTimestamp - previous.endTimestamp) * 1e3]
      expect(node.space).toEqual([1500000, 500000]); // [1500 * 1000, (2000 - 1500) * 1000]
    });

    it('should set parent correctly', () => {
      const extra = createMockExtra();
      const parentValue = makeEAPSpan({
        event_id: 'parent-span',
        is_transaction: true,
      });
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous-span',
        end_timestamp: 1500,
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span',
        start_timestamp: 2000,
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const parentNode = new EapSpanNode(null, parentValue, extra);
      const previousNode = new EapSpanNode(parentNode, previousSpanValue, extra);
      const nextNode = new EapSpanNode(parentNode, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        parentNode,
        missingInstrValue,
        extra
      );

      expect(node.parent).toBe(parentNode);
    });
  });

  describe('getter methods', () => {
    it('should return correct drawerTabsTitle', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.drawerTabsTitle).toBe('No Instrumentation');
    });

    it('should return correct traceHeaderTitle', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.traceHeaderTitle).toEqual({
        title: 'Trace',
        subtitle: undefined,
      });
    });
  });

  describe('pathToNode', () => {
    it('should return path without transaction when no parent transaction found', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      const path = node.pathToNode();
      expect(path).toHaveLength(1);
      expect(path[0]).toMatch(/^ms-/); // Should start with 'ms-'
      expect(typeof path[0]).toBe('string');
    });

    it('should include transaction ID in path when closest transaction parent found', () => {
      const extra = createMockExtra();
      const transactionValue = makeTransaction({
        event_id: 'transaction-id',
        'transaction.op': 'navigation',
      });
      const spanValue = makeSpan({
        span_id: 'span-id',
        op: 'db.query',
      });
      const previousSpanValue = makeSpan({span_id: 'previous'});
      const nextSpanValue = makeSpan({span_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const transactionNode = new TransactionNode(null, transactionValue, extra);
      const spanNode = new SpanNode(transactionNode, spanValue, extra);
      const previousNode = new SpanNode(spanNode, previousSpanValue, extra);
      const nextNode = new SpanNode(spanNode, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        spanNode,
        missingInstrValue,
        extra
      );

      const path = node.pathToNode();
      expect(path).toHaveLength(2);
      expect(path[0]).toMatch(/^ms-/); // First should be missing instrumentation ID
      expect(path[1]).toBe('txn-transaction-id'); // Second should be transaction ID
    });

    it('should find closest transaction parent even when deeply nested', () => {
      const extra = createMockExtra();
      const transactionValue = makeTransaction({
        event_id: 'root-transaction',
        transaction: 'navigation',
        'transaction.op': 'navigation',
      });
      const span1Value = makeSpan({span_id: 'span1', op: 'db.query'});
      const span2Value = makeSpan({span_id: 'span2', op: 'http.request'});
      const span3Value = makeSpan({span_id: 'span3', op: 'cache.get'});

      const previousSpanValue = makeSpan({span_id: 'previous'});
      const nextSpanValue = makeSpan({span_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const transactionNode = new TransactionNode(null, transactionValue, extra);
      const span1Node = new SpanNode(transactionNode, span1Value, extra);
      const span2Node = new SpanNode(span1Node, span2Value, extra);
      const span3Node = new SpanNode(span2Node, span3Value, extra);
      const previousNode = new SpanNode(span3Node, previousSpanValue, extra);
      const nextNode = new SpanNode(span3Node, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        span3Node,
        missingInstrValue,
        extra
      );

      const path = node.pathToNode();
      expect(path).toHaveLength(2);
      expect(path[0]).toMatch(/^ms-/);
      expect(path[1]).toBe('txn-root-transaction');
    });

    it('should handle parent without transaction correctly', () => {
      const extra = createMockExtra();
      const spanValue = makeEAPSpan({
        event_id: 'regular-span',
        is_transaction: false,
        op: 'db.query',
      });
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const spanNode = new EapSpanNode(null, spanValue, extra);
      const previousNode = new EapSpanNode(spanNode, previousSpanValue, extra);
      const nextNode = new EapSpanNode(spanNode, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        spanNode,
        missingInstrValue,
        extra
      );

      const path = node.pathToNode();
      expect(path).toHaveLength(1);
      expect(path[0]).toMatch(/^ms-/);
    });
  });

  describe('abstract method implementations', () => {
    it('should return correct analyticsName', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.analyticsName()).toBe('missing instrumentation');
    });

    it('should return correct printNode', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.printNode()).toBe('missing_instrumentation');
    });
  });

  describe('matchWithFreeText', () => {
    it('should always return false', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.matchWithFreeText('missing')).toBe(false);
      expect(node.matchWithFreeText('instrumentation')).toBe(false);
      expect(node.matchWithFreeText('anything')).toBe(false);
      expect(node.matchWithFreeText('')).toBe(false);
    });
  });

  describe('makeBarColor', () => {
    it('should return gray300 color from theme', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.makeBarColor(ThemeFixture())).toBe(ThemeFixture().colors.gray400);
    });
  });

  describe('matchById', () => {
    it('should match by previous node ID', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous-span-id',
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span-id',
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.matchById('previous-span-id')).toBe(true);
    });

    it('should match by next node ID', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous-span-id',
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span-id',
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.matchById('next-span-id')).toBe(true);
    });

    it('should return false when ID does not match either node', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous-span-id',
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span-id',
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.matchById('non-existent-id')).toBe(false);
    });

    it('should handle undefined node IDs', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: undefined,
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next-span-id',
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const previousNode = new EapSpanNode(null, previousSpanValue, extra);
      const nextNode = new EapSpanNode(null, nextSpanValue, extra);
      const node = new NoInstrumentationNode(
        previousNode,
        nextNode,
        null,
        missingInstrValue,
        extra
      );

      expect(node.matchById('next-span-id')).toBe(true);
      expect(node.matchById('undefined')).toBe(false);
    });
  });
});
