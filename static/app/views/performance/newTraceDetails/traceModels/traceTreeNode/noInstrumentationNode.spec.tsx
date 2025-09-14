import type {Theme} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {TraceRowProps} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

import type {TraceTreeNodeExtra} from './baseNode';
import {EapSpanNode} from './eapSpanNode';
import {NoInstrumentationNode} from './noInstrumentationNode';

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
    it('should return unique id on each call', () => {
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

      const id1 = node.id;
      const id2 = node.id;

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2); // Each call should return a new UUID
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

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

  describe('abstract method implementations', () => {
    it('should return correct pathToNode', () => {
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

    it('should render waterfall row', () => {
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

    it('should render details for missing instrumentation node', () => {
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

      const mockProps = {
        node: node as any,
        organization: OrganizationFixture(),
        onParentClick: jest.fn(),
        onTabScrollToNode: jest.fn(),
      } as unknown as TraceTreeNodeDetailsProps<any>;

      const result = node.renderDetails(mockProps);
      expect(result).toBeDefined();
    });

    it('should return null for renderDetails when node is not missing instrumentation', () => {
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

      // Mock a different node type
      const mockProps = {
        node: previousNode as any, // Pass a different node type
        organization: OrganizationFixture(),
        onParentClick: jest.fn(),
        onTabScrollToNode: jest.fn(),
      } as unknown as TraceTreeNodeDetailsProps<any>;

      const result = node.renderDetails(mockProps);
      expect(result).toBeNull();
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
    it('should return gray color', () => {
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

      const mockTheme: Partial<Theme> = {
        gray300: '#a0a0a0',
      };

      expect(node.makeBarColor(mockTheme as Theme)).toBe('#a0a0a0');
    });
  });

  describe('edge cases', () => {
    it('should handle zero timestamps', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous',
        start_timestamp: 0,
        end_timestamp: 0,
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next',
        start_timestamp: 0,
        end_timestamp: 1,
      });
      const missingInstrValue = createMissingInstrumentationSpan({
        start_timestamp: 0,
        timestamp: 0,
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

      expect(node.space).toEqual([0, 0]);
    });

    it('should handle negative time gaps', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous',
        start_timestamp: 1000,
        end_timestamp: 2000,
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next',
        start_timestamp: 1500, // Overlapping with previous
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

      // Should handle negative gap (overlapping spans)
      expect(node.space).toEqual([2000000, -500000]); // [2000 * 1000, (1500 - 2000) * 1000]
    });

    it('should handle same previous and next nodes', () => {
      const extra = createMockExtra();
      const spanValue = makeEAPSpan({
        event_id: 'same-span',
        start_timestamp: 1000,
        end_timestamp: 2000,
      });
      const missingInstrValue = createMissingInstrumentationSpan();

      const spanNode = new EapSpanNode(null, spanValue, extra);
      const node = new NoInstrumentationNode(
        spanNode,
        spanNode, // Same node as both previous and next
        null,
        missingInstrValue,
        extra
      );

      expect(node.previous).toBe(spanNode);
      expect(node.next).toBe(spanNode);
      expect(node.space).toEqual([2000000, -1000000]); // [end * 1000, (start - end) * 1000]
    });

    it('should handle large timestamp values', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({
        event_id: 'previous',
        start_timestamp: 1000000000,
        end_timestamp: 1000001000,
      });
      const nextSpanValue = makeEAPSpan({
        event_id: 'next',
        start_timestamp: 1000002000,
        end_timestamp: 1000003000,
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

      expect(node.space).toEqual([1000001000000, 1000000]); // Large numbers handled correctly
    });

    it('should handle different missing instrumentation span values', () => {
      const extra = createMockExtra();
      const previousSpanValue = makeEAPSpan({event_id: 'previous'});
      const nextSpanValue = makeEAPSpan({event_id: 'next'});
      const missingInstrValue = createMissingInstrumentationSpan({
        start_timestamp: 5000,
        timestamp: 10000,
        type: 'missing_instrumentation',
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

      expect(node.value.start_timestamp).toBe(5000);
      expect(node.value.timestamp).toBe(10000);
      expect(node.value.type).toBe('missing_instrumentation');
    });
  });
});
