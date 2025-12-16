import {TreemapType, type DiffItem} from 'sentry/views/preprod/types/appSizeTypes';

import {
  buildTreeFromDiffItems,
  buildTreemapDiff,
  formatSizeDiff,
  getFileSize,
} from './treemapDiffUtils';

describe('treemapDiffUtils', () => {
  describe('formatSizeDiff', () => {
    it('should format positive size diffs with + sign', () => {
      expect(formatSizeDiff(1024)).toBe('+1.02 KB');
      expect(formatSizeDiff(5000)).toBe('+5 KB');
    });

    it('should format negative size diffs without extra sign', () => {
      expect(formatSizeDiff(-1024)).toBe('-1,024 B');
      expect(formatSizeDiff(-5000)).toBe('-5,000 B');
    });

    it('should format zero diff without sign', () => {
      expect(formatSizeDiff(0)).toBe('0 B');
    });
  });

  describe('getFileSize', () => {
    it('should return head_size for added files', () => {
      const diffItem: DiffItem = {
        path: 'src/file.js',
        size_diff: 1000,
        type: 'added',
        head_size: 1500,
        base_size: null,
        item_type: TreemapType.FILES,
      };

      expect(getFileSize(diffItem)).toBe(1500);
    });

    it('should return base_size for removed files', () => {
      const diffItem: DiffItem = {
        path: 'src/removed.js',
        size_diff: -1000,
        type: 'removed',
        head_size: null,
        base_size: 1000,
        item_type: TreemapType.FILES,
      };

      expect(getFileSize(diffItem)).toBe(1000);
    });

    it('should return head_size for increased files', () => {
      const diffItem: DiffItem = {
        path: 'src/increased.js',
        size_diff: 500,
        type: 'increased',
        head_size: 1500,
        base_size: 1000,
        item_type: TreemapType.FILES,
      };

      expect(getFileSize(diffItem)).toBe(1500);
    });

    it('should return head_size for decreased files', () => {
      const diffItem: DiffItem = {
        path: 'src/decreased.js',
        size_diff: -200,
        type: 'decreased',
        head_size: 800,
        base_size: 1000,
        item_type: TreemapType.FILES,
      };

      expect(getFileSize(diffItem)).toBe(800);
    });

    it('should calculate size from base_size + size_diff as fallback', () => {
      const diffItem: DiffItem = {
        path: 'src/fallback.js',
        size_diff: 300,
        type: 'increased',
        head_size: null,
        base_size: 1000,
        item_type: TreemapType.FILES,
      };

      expect(getFileSize(diffItem)).toBe(1300);
    });

    it('should use absolute value of size_diff as last resort', () => {
      const diffItem: DiffItem = {
        path: 'src/last-resort.js',
        size_diff: -500,
        type: 'removed',
        head_size: null,
        base_size: null,
        item_type: TreemapType.FILES,
      };

      expect(getFileSize(diffItem)).toBe(500);
    });
  });

  describe('buildTreeFromDiffItems', () => {
    it('should return null for empty diff items', () => {
      const result = buildTreeFromDiffItems([]);
      expect(result).toBeNull();
    });

    it('should create a simple tree for single file', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/app.js',
          size_diff: 1000,
          type: 'added',
          head_size: 2000,
          base_size: null,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreeFromDiffItems(diffItems);

      expect(result).toBeDefined();
      expect(result!.name).toBe('root');
      expect(result!.children).toHaveLength(1);

      const srcDir = result!.children![0]!;
      expect(srcDir.name).toBe('src');
      expect(srcDir.is_dir).toBe(true);
      expect(srcDir.path).toBe('src');
      expect(srcDir.children).toHaveLength(1);

      const appFile = srcDir.children![0]!;
      expect(appFile.name).toBe('app.js');
      expect(appFile.is_dir).toBe(false);
      expect(appFile.path).toBe('src/app.js');
      expect(appFile.size).toBe(2000);
      expect(appFile.size_diff).toBe(1000);
      expect(appFile.diff_type).toBe('added');
    });

    it('should create nested directory structure', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/components/Button.tsx',
          size_diff: 500,
          type: 'added',
          head_size: 1500,
          base_size: null,
          item_type: TreemapType.FILES,
        },
        {
          path: 'src/utils/helpers.js',
          size_diff: 200,
          type: 'added',
          head_size: 800,
          base_size: null,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreeFromDiffItems(diffItems);

      expect(result).toBeDefined();
      expect(result!.children).toHaveLength(1);

      const srcDir = result!.children![0]!;
      expect(srcDir.name).toBe('src');
      expect(srcDir.children).toHaveLength(2);

      const componentsDir = srcDir.children!.find(child => child.name === 'components');
      const utilsDir = srcDir.children!.find(child => child.name === 'utils');

      expect(componentsDir).toBeDefined();
      expect(componentsDir!.children).toHaveLength(1);
      expect(componentsDir!.children![0]!.name).toBe('Button.tsx');

      expect(utilsDir).toBeDefined();
      expect(utilsDir!.children).toHaveLength(1);
      expect(utilsDir!.children![0]!.name).toBe('helpers.js');
    });

    it('should handle files at root level', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'package.json',
          size_diff: 100,
          type: 'increased',
          head_size: 1200,
          base_size: 1100,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreeFromDiffItems(diffItems);

      expect(result).toBeDefined();
      expect(result!.children).toHaveLength(1);

      const packageFile = result!.children![0]!;
      expect(packageFile.name).toBe('package.json');
      expect(packageFile.is_dir).toBe(false);
      expect(packageFile.path).toBe('package.json');
      expect(packageFile.size).toBe(1200);
      expect(packageFile.size_diff).toBe(100);
    });

    it('should aggregate directory sizes and diffs', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/file1.js',
          size_diff: 500,
          type: 'added',
          head_size: 1000,
          base_size: null,
          item_type: TreemapType.FILES,
        },
        {
          path: 'src/file2.js',
          size_diff: 300,
          type: 'added',
          head_size: 800,
          base_size: null,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreeFromDiffItems(diffItems);

      expect(result).toBeDefined();

      const srcDir = result!.children![0]!;
      expect(srcDir.size).toBe(1800); // 1000 + 800
      expect(srcDir.size_diff).toBe(800); // 500 + 300
      expect(srcDir.diff_type).toBe('increased');

      // Root should also aggregate
      expect(result!.size).toBe(1800);
      expect(result!.size_diff).toBe(800);
    });

    it('should handle removed files correctly', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/removed.js',
          size_diff: -1000,
          type: 'removed',
          head_size: null,
          base_size: 1000,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreeFromDiffItems(diffItems);

      expect(result).toBeDefined();

      const removedFile = result!.children![0]!.children![0]!;
      expect(removedFile.name).toBe('removed.js');
      expect(removedFile.diff_type).toBe('removed');
      expect(removedFile.size).toBe(1000); // base_size
      expect(removedFile.size_diff).toBe(-1000);

      // Directory should have decreased type
      const srcDir = result!.children![0]!;
      expect(srcDir.diff_type).toBe('decreased');
      expect(srcDir.size_diff).toBe(-1000);
    });
  });

  describe('buildTreemapDiff', () => {
    it('should return null for empty diff items', () => {
      const result = buildTreemapDiff([]);
      expect(result).toBeNull();
    });

    it('should return null when no changes are detected', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/unchanged.js',
          size_diff: 0,
          type: 'increased',
          head_size: 1000,
          base_size: 1000,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreemapDiff(diffItems);
      expect(result).toBeNull();
    });

    it('should return treemap diff results with root when changes exist', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/changed.js',
          size_diff: 500,
          type: 'increased',
          head_size: 1500,
          base_size: 1000,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreemapDiff(diffItems);

      expect(result).toBeDefined();
      expect(result!).toBeDefined();
      expect(result!.name).toBe('root');
      expect(result!.children).toHaveLength(1);
    });

    it('should handle mixed diff types correctly', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/added.js',
          size_diff: 1000,
          type: 'added',
          head_size: 1000,
          base_size: null,
          item_type: TreemapType.FILES,
        },
        {
          path: 'src/removed.js',
          size_diff: -800,
          type: 'removed',
          head_size: null,
          base_size: 800,
          item_type: TreemapType.FILES,
        },
        {
          path: 'src/increased.js',
          size_diff: 200,
          type: 'increased',
          head_size: 1200,
          base_size: 1000,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreemapDiff(diffItems);

      expect(result).toBeDefined();
      expect(result!.children).toHaveLength(1);

      const srcDir = result!.children![0]!;
      expect(srcDir.children).toHaveLength(3);
      expect(srcDir.size_diff).toBe(400); // 1000 - 800 + 200
      expect(srcDir.diff_type).toBe('increased');
    });

    it('should handle deeply nested paths', () => {
      const diffItems: DiffItem[] = [
        {
          path: 'src/components/ui/Button/Button.tsx',
          size_diff: 300,
          type: 'added',
          head_size: 2000,
          base_size: null,
          item_type: TreemapType.FILES,
        },
        {
          path: 'src/components/ui/Button/Button.test.tsx',
          size_diff: 150,
          type: 'added',
          head_size: 1000,
          base_size: null,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreemapDiff(diffItems);

      expect(result).toBeDefined();

      // Navigate through the directory structure
      const src = result!.children![0]!;
      expect(src.name).toBe('src');

      const components = src.children!.find(child => child.name === 'components')!;
      expect(components.name).toBe('components');

      const ui = components.children!.find(child => child.name === 'ui')!;
      expect(ui.name).toBe('ui');

      const buttonDir = ui.children!.find(child => child.name === 'Button')!;
      expect(buttonDir.name).toBe('Button');
      expect(buttonDir.children).toHaveLength(2);

      // Check aggregations work correctly at each level
      expect(buttonDir.size_diff).toBe(450); // 300 + 150
      expect(ui.size_diff).toBe(450);
      expect(components.size_diff).toBe(450);
      expect(src.size_diff).toBe(450);
      expect(result!.size_diff).toBe(450);
    });
  });
});
