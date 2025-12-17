import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {type TraceTreeNodeExtra} from './baseNode';
import {RootNode} from './rootNode';

const theme = ThemeFixture();

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('RootNode', () => {
  describe('constructor', () => {
    it('should initialize RootNode with correct properties', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      expect(rootNode.parent).toBeNull();
      expect(rootNode.value).toBeNull();
      expect(rootNode.extra).toBe(extra);
      // Inherited properties from BaseNode
      expect(rootNode.expanded).toBe(true);
      expect(rootNode.errors).toBeInstanceOf(Set);
      expect(rootNode.occurrences).toBeInstanceOf(Set);
      expect(rootNode.canShowDetails).toBe(false);
    });
  });

  describe('type getter', () => {
    it('should return ROOT node type', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      expect(rootNode.type).toBe('root');
    });
  });

  describe('drawerTabsTitle getter', () => {
    it('should return localized "Root" string', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      const title = rootNode.drawerTabsTitle;

      expect(title).toBe('Root');
    });
  });

  describe('traceHeaderTitle getter', () => {
    it('should return correct title and subtitle structure', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      const headerTitle = rootNode.traceHeaderTitle;

      expect(headerTitle).toEqual({
        title: 'Trace',
        subtitle: rootNode.description,
      });
    });
  });

  describe('makeBarColor', () => {
    it('should return the color from pickBarColor', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      const color = rootNode.makeBarColor(theme);

      expect(color).toBe('#C81792');
    });
  });

  describe('printNode', () => {
    it('should return "virtual root" string', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      const nodeString = rootNode.printNode();

      expect(nodeString).toBe('virtual root');
    });
  });

  describe('analyticsName', () => {
    it('should return "root"', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      expect(rootNode.analyticsName()).toBe('root');
    });
  });

  describe('matchWithFreeText', () => {
    it('should match by path', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      expect(rootNode.matchByPath('root' as TraceTree.NodePath)).toBe(false);
    });

    it('should always return false', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      expect(rootNode.matchWithFreeText('root')).toBe(false);
      expect(rootNode.matchWithFreeText('trace')).toBe(false);
      expect(rootNode.matchWithFreeText('anything')).toBe(false);
      expect(rootNode.matchWithFreeText('')).toBe(false);
      expect(rootNode.matchWithFreeText('virtual root')).toBe(false);
    });

    it('should return false for any search key', () => {
      const extra = createMockExtra();
      const rootNode = new RootNode(null, null, extra);

      // Test various search terms
      const searchTerms = [
        'test',
        'search',
        'query',
        'node',
        'span',
        'transaction',
        '123',
        'special-chars!@#',
        'unicode-テスト',
      ];

      searchTerms.forEach(term => {
        expect(rootNode.matchWithFreeText(term)).toBe(false);
      });
    });
  });
});
