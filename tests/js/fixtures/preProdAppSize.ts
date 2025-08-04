import type {
  AppleInsightResults,
  OptimizableImageFile,
  TreemapElement,
} from 'sentry/views/preprod/types/appSizeTypes';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

export function ProcessedInsightFixture(
  params: Partial<ProcessedInsight> = {}
): ProcessedInsight {
  return {
    name: 'Duplicate files',
    description: 'You have files that are duplicated across your app',
    totalSavings: 1024000,
    percentage: 15.5,
    files: [
      {
        path: 'src/components/Button.js',
        savings: 512000,
        percentage: 7.5,
        data: {
          fileType: 'regular' as const,
          originalFile: {
            file_path: 'src/components/Button.js',
            total_savings: 512000,
          },
        },
      },
      {
        path: 'src/components/Icon.js',
        savings: 256000,
        percentage: 4.0,
        data: {
          fileType: 'regular' as const,
          originalFile: {
            file_path: 'src/components/Icon.js',
            total_savings: 256000,
          },
        },
      },
      {
        path: 'src/assets/logo.png',
        savings: 256000,
        percentage: 4.0,
        data: {
          fileType: 'optimizable_image' as const,
          originalFile: {
            best_optimization_type: 'convert_to_heic',
            conversion_savings: 128000,
            current_size: 256000,
            file_path: 'src/assets/logo.png',
            heic_size: 128000,
            minified_size: null,
            minify_savings: 0,
            potential_savings: 128000,
          } as OptimizableImageFile,
        },
      },
    ],
    ...params,
  };
}

export function AppleInsightResultsFixture(
  params: Partial<AppleInsightResults> = {}
): AppleInsightResults {
  return {
    duplicate_files: {
      total_savings: 768000,
      groups: [
        {
          name: 'Duplicate files',
          total_savings: 768000,
          files: [
            {
              file_path: 'src/components/Button.js',
              total_savings: 512000,
            },
            {
              file_path: 'src/components/Icon.js',
              total_savings: 256000,
            },
          ],
        },
      ],
    },
    large_images: {
      total_savings: 512000,
      files: [
        {
          file_path: 'src/assets/logo.png',
          total_savings: 512000,
        },
      ],
    },
    large_videos: {
      total_savings: 256000,
      files: [
        {
          file_path: 'src/assets/video.mp4',
          total_savings: 256000,
        },
      ],
    },
    ...params,
  };
}

export function TreemapElementFixture(
  params: Partial<TreemapElement> = {}
): TreemapElement {
  return {
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
    ...params,
  };
}
