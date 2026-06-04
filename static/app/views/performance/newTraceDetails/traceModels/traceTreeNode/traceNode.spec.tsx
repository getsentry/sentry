import {OrganizationFixture} from 'sentry-fixture/organization';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {type TraceTreeNodeExtra} from './baseNode';
import {RootNode} from './rootNode';
import {TraceNode} from './traceNode';

const createMockExtra = (): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
});

const createMockTraceValue = (): TraceTree.Trace => [
  makeEAPSpan({
    event_id: 'test-trace-id',
    project_slug: 'test-project',
  }),
];

describe('TraceNode', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const traceNode = new TraceNode(null, traceValue, extra);

      expect(traceNode.canShowDetails).toBe(false);
    });

    it('should add itself to parent children when parent is provided', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();
      const rootNode = new RootNode(null, null, extra);

      const traceNode = new TraceNode(rootNode, traceValue, extra);

      expect(traceNode.parent).toBe(rootNode);
      expect(rootNode.children).toContain(traceNode);
    });

    it('should not attempt to add to parent when parent is null', () => {
      const extra = createMockExtra();
      const traceValue = createMockTraceValue();

      const traceNode = new TraceNode(null, traceValue, extra);

      expect(traceNode.parent).toBeNull();
    });
  });

  describe('getter methods', () => {
    it('should return "Trace" for drawerTabsTitle', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.drawerTabsTitle).toBe('Trace');
    });

    it('should return title object for traceHeaderTitle', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.traceHeaderTitle).toEqual({
        title: 'Trace',
      });
    });
  });

  describe('pathToNode', () => {
    it('should return trace-root path', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.pathToNode()).toEqual(['trace-root']);
    });
  });

  describe('analyticsName', () => {
    it('should return "trace"', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.analyticsName()).toBe('trace');
    });
  });

  describe('printNode', () => {
    it('should return "trace root" for trace split result', () => {
      const traceNode = new TraceNode(
        null,
        {
          transactions: [],
          orphan_errors: [],
        },
        createMockExtra()
      );

      expect(traceNode.printNode()).toBe('trace root');
    });

    it('should return "eap trace root" for EAP trace', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.printNode()).toBe('eap trace root');
    });
  });

  describe('matchById', () => {
    it('should always return false', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.matchById('any-id')).toBe(false);
      expect(traceNode.matchById('trace-root')).toBe(false);
      expect(traceNode.matchById('')).toBe(false);
    });
  });

  describe('matchWithFreeText', () => {
    it('should always return false', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.matchWithFreeText('trace')).toBe(false);
      expect(traceNode.matchWithFreeText('root')).toBe(false);
      expect(traceNode.matchWithFreeText('anything')).toBe(false);
      expect(traceNode.matchWithFreeText('')).toBe(false);
    });
  });

  describe('expand', () => {
    it('should always return false', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.expand(true, {} as any)).toBe(false);
      expect(traceNode.expand(false, {} as any)).toBe(false);
    });
  });

  describe('abstract method implementations', () => {
    it('should implement matchByPath', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      expect(traceNode.matchByPath('trace-root')).toBe(true);
      expect(traceNode.matchByPath('trace-123')).toBe(false);
    });

    it('should implement renderWaterfallRow', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      const result = traceNode.renderWaterfallRow({} as any);

      expect(result).toBeDefined();
    });

    it('should implement renderDetails returning null', () => {
      const traceNode = new TraceNode(null, createMockTraceValue(), createMockExtra());

      const result = traceNode.renderDetails({} as any);

      expect(result).toBeNull();
    });
  });
});
