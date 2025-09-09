import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {type TraceTreeNodeExtra} from './baseNode';
import {RootNode} from './rootNode';
import {TraceNode} from './traceNode';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

const createMockTraceValue = (override?: TraceTree.Trace): TraceTree.Trace => {
  return override
    ? override
    : [
        makeEAPSpan({
          event_id: 'test-trace-id',
          project_slug: 'test-project',
          description: 'Test trace description',
          op: 'trace.operation',
        }),
        makeEAPSpan({
          event_id: 'test-trace-id',
          project_slug: 'test-project',
          description: 'Test trace description',
          op: 'trace.operation',
        }),
      ];
};

describe('TraceNode', () => {
  describe('constructor', () => {
    it('should initialize TraceNode with correct properties', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      expect(traceNode.parent).toBe(parentNode);
      expect(traceNode.value).toBe(traceValue);
      expect(traceNode.extra).toBe(extra);
      // Inherited properties from BaseNode
      expect(traceNode.expanded).toBe(true);
      expect(traceNode.children).toEqual([]);
      expect(traceNode.errors).toBeInstanceOf(Set);
      expect(traceNode.occurrences).toBeInstanceOf(Set);
      expect(traceNode.profiles).toBeInstanceOf(Set);
    });
  });

  describe('pathToNode', () => {
    it('should return correct path with trace ID', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      expect(traceNode.pathToNode()).toStrictEqual(['trace-root']);
    });
  });

  describe('drawerTabsTitle getter', () => {
    it('should return "Trace" string', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      const title = traceNode.drawerTabsTitle;

      expect(title).toBe('Trace');
    });
  });

  describe('traceHeaderTitle getter', () => {
    it('should return correct title and subtitle structure', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      const headerTitle = traceNode.traceHeaderTitle;

      expect(headerTitle).toEqual({
        title: 'Trace',
        subtitle: undefined,
      });
    });
  });

  describe('analyticsName', () => {
    it('should return "trace"', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      expect(traceNode.analyticsName()).toBe('trace');
    });
  });

  describe('printNode', () => {
    it('should return "trace root" string', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      const nodeString = traceNode.printNode();

      expect(nodeString).toBe('trace root');
    });
  });

  describe('matchWithFreeText', () => {
    it('should always return false', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      expect(traceNode.matchWithFreeText('trace')).toBe(false);
      expect(traceNode.matchWithFreeText('root')).toBe(false);
      expect(traceNode.matchWithFreeText('anything')).toBe(false);
      expect(traceNode.matchWithFreeText('')).toBe(false);
      expect(traceNode.matchWithFreeText('trace root')).toBe(false);
    });

    it('should return false for any search key', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const parentNode = new RootNode(null, traceValue, extra);
      const traceNode = new TraceNode(parentNode, traceValue, extra);

      // Test various search terms
      const searchTerms = [
        'test',
        'search',
        'query',
        'node',
        'span',
        'transaction',
        'description',
        '123',
        'special-chars!@#',
        'unicode-テスト',
      ];

      searchTerms.forEach(term => {
        expect(traceNode.matchWithFreeText(term)).toBe(false);
      });
    });
  });
});
