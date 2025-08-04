import type {TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';

import {filterTreemapElement} from './treemapFiltering';

describe('treemapFiltering', () => {
  describe('filterTreemapElement', () => {
    const mockTreemapElement: TreemapElement = {
      name: 'root',
      size: 1000,
      type: 'files' as any,
      is_dir: true,
      children: [
        {
          name: 'src',
          size: 500,
          type: 'files' as any,
          is_dir: true,
          path: '/app/src',
          children: [
            {
              name: 'main.js',
              size: 200,
              type: 'files' as any,
              is_dir: false,
              path: '/app/src/main.js',
              children: [],
            },
            {
              name: 'utils.js',
              size: 300,
              type: 'files' as any,
              is_dir: false,
              path: '/app/src/utils.js',
              children: [],
            },
          ],
        },
        {
          name: 'assets',
          size: 500,
          type: 'assets' as any,
          is_dir: true,
          path: '/app/assets',
          children: [
            {
              name: 'image.png',
              size: 500,
              type: 'assets' as any,
              is_dir: false,
              path: '/app/assets/image.png',
              children: [],
            },
          ],
        },
      ],
    };

    it('returns original element when search query is empty', () => {
      const result = filterTreemapElement(mockTreemapElement, '');
      expect(result).toEqual(mockTreemapElement);
    });

    it('returns original element when search query is only whitespace', () => {
      const result = filterTreemapElement(mockTreemapElement, '   ');
      expect(result).toEqual(mockTreemapElement);
    });

    it('filters by file name', () => {
      const result = filterTreemapElement(mockTreemapElement, 'main');
      expect(result).toBeTruthy();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].name).toBe('src');
      expect(result?.children[0].children).toHaveLength(1);
      expect(result?.children[0].children[0].name).toBe('main.js');
    });

    it('filters by path', () => {
      const result = filterTreemapElement(mockTreemapElement, 'utils.js');
      expect(result).toBeTruthy();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].name).toBe('src');
      expect(result?.children[0].children).toHaveLength(1);
      expect(result?.children[0].children[0].name).toBe('utils.js');
    });

    it('filters case-insensitively', () => {
      const result = filterTreemapElement(mockTreemapElement, 'MAIN');
      expect(result).toBeTruthy();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].children[0].name).toBe('main.js');
    });

    it('returns null when no matches found', () => {
      const result = filterTreemapElement(mockTreemapElement, 'nonexistent');
      expect(result).toBeNull();
    });

    it('includes parent directories when children match', () => {
      const result = filterTreemapElement(mockTreemapElement, 'main.js');
      expect(result).toBeTruthy();
      expect(result?.name).toBe('root');
      expect(result?.children[0].name).toBe('src');
    });
  });
});
