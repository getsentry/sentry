import {TreemapElementFixture} from 'sentry-fixture/preProdAppSize';

import {filterTreemapElement} from './treemapFiltering';

describe('treemapFiltering', () => {
  describe('filterTreemapElement', () => {
    it('returns original element when search query is empty', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, '');
      expect(result).toEqual(treemapElement);
    });

    it('returns original element when search query is only whitespace', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, '   ');
      expect(result).toEqual(treemapElement);
    });

    it('filters by file name', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, 'main');
      expect(result).toBeTruthy();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0]!.name).toBe('src');
      expect(result?.children[0]!.children).toHaveLength(1);
      expect(result?.children[0]!.children[0]!.name).toBe('main.js');
    });

    it('filters by path', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, 'utils.js');
      expect(result).toBeTruthy();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0]!.name).toBe('src');
      expect(result?.children[0]!.children).toHaveLength(1);
      expect(result?.children[0]!.children[0]!.name).toBe('utils.js');
    });

    it('filters case-insensitively', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, 'MAIN');
      expect(result).toBeTruthy();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0]!.children[0]!.name).toBe('main.js');
    });

    it('returns null when no matches found', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, 'nonexistent');
      expect(result).toBeNull();
    });

    it('includes parent directories when children match', () => {
      const treemapElement = TreemapElementFixture();
      const result = filterTreemapElement(treemapElement, 'main.js');
      expect(result).toBeTruthy();
      expect(result?.name).toBe('root');
      expect(result?.children[0]!.name).toBe('src');
    });
  });
});
