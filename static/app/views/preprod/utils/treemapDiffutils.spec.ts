import {TreemapType, type DiffItem} from 'sentry/views/preprod/types/appSizeTypes';

import {buildTreeFromDiffItems, buildTreemapDiff} from './treemapDiffUtils';

describe('treemapDiffUtils', () => {
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
      expect(srcDir.size_diff).toBe(800); // 500 + 300
      expect(srcDir.diff_type).toBe('increased');

      // Root should also aggregate
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
      expect(removedFile.size_diff).toBe(-1000);

      // Directory should have decreased type
      const srcDir = result!.children![0]!;
      expect(srcDir.diff_type).toBe('decreased');
      expect(srcDir.size_diff).toBe(-1000);
    });

    it('should assign diff_type correctly for parent/child with mixed increases and decreases (Emerge edge case)', () => {
      // Edge case seen before
      //         (A -50)
      //       /        \
      //   (B -51)    (C +1)
      //
      // Root
      //  └── A (size_diff: -50, children: [B, C])
      //         ├── B (size_diff: -51)
      //         └── C (size_diff: +1)

      const diffItems: DiffItem[] = [
        {
          path: 'A/B',
          size_diff: -51 * 1024 * 1024,
          type: 'decreased',
          head_size: 10 * 1024 * 1024,
          base_size: 61 * 1024 * 1024,
          item_type: TreemapType.FILES,
        },
        {
          path: 'A/C',
          size_diff: 1 * 1024 * 1024,
          type: 'increased',
          head_size: 2 * 1024 * 1024,
          base_size: 1 * 1024 * 1024,
          item_type: TreemapType.FILES,
        },
      ];

      const result = buildTreeFromDiffItems(diffItems);

      expect(result).toBeDefined();
      // Root
      expect(result!.diff_type).toBe('decreased');

      // Get A directory
      const aDir = result!.children!.find(child => child.name === 'A')!;
      expect(aDir).toBeDefined();
      expect(aDir.size_diff).toBe(-50 * 1024 * 1024); // -51 + 1
      expect(aDir.diff_type).toBe('decreased'); // overall decreased

      // Children
      const bFile = aDir.children!.find(child => child.name === 'B')!;
      expect(bFile).toBeDefined();
      expect(bFile.size_diff).toBe(-51 * 1024 * 1024);
      expect(bFile.diff_type).toBe('decreased');

      const cFile = aDir.children!.find(child => child.name === 'C')!;
      expect(cFile).toBeDefined();
      expect(cFile.size_diff).toBe(1 * 1024 * 1024);
      expect(cFile.diff_type).toBe('increased');
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
