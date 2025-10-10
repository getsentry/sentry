import type {
  AppleInsightResults,
  FileSavingsResult,
  FileSavingsResultGroup,
  FilesInsightResult,
  GroupsInsightResult,
  OptimizableImageFile,
  StripBinaryFileInfo,
} from 'sentry/views/preprod/types/appSizeTypes';

type FileTypeData =
  | {
      conversionPercentage: number;
      fileType: 'optimizable_image';
      minifyPercentage: number;
      originalFile: OptimizableImageFile;
    }
  | {fileType: 'strip_binary'; originalFile: StripBinaryFileInfo}
  | {fileType: 'regular'; originalFile: FileSavingsResult};

export interface ProcessedInsightFile {
  data: FileTypeData;
  path: string;
  percentage: number;
  savings: number;
}

export interface ProcessedInsight {
  description: string;
  files: ProcessedInsightFile[];
  name: string;
  percentage: number;
  totalSavings: number;
}

interface InsightConfig {
  description: string;
  key: string;
  name: string;
}

const INSIGHT_CONFIGS: InsightConfig[] = [
  {
    key: 'image_optimization',
    name: 'Optimize images',
    description:
      'We determine how much size could be saved if images were optimized. In some cases you can convert to HEIC for better compression.',
  },
  {
    key: 'duplicate_files',
    name: 'Remove duplicate files',
    description:
      'Multiple copies of the same file were found, expand each to see the duplicates. Move files to shared locations to save space.',
  },
  {
    key: 'strip_binary',
    name: 'Strip Binary Symbols',
    description:
      'Debug symbols and symbol tables can be removed from binaries to reduce size.',
  },
  {
    key: 'loose_images',
    name: 'Move images to asset catalogs',
    description: 'Loose image files can be moved to asset catalogs to reduce size.',
  },
  {
    key: 'main_binary_exported_symbols',
    name: 'Remove Symbol Metadata',
    description: 'Symbol metadata can be removed to reduce binary size.',
  },
  {
    key: 'large_images',
    name: 'Compress large images',
    description: 'Large image files can be compressed to reduce size.',
  },
  {
    key: 'large_videos',
    name: 'Compress large videos',
    description: 'Large video files can be compressed to reduce size.',
  },
  {
    key: 'large_audio',
    name: 'Compress large audio files',
    description: 'Large audio files can be compressed to reduce size.',
  },
  {
    key: 'unnecessary_files',
    name: 'Remove unnecessary files',
    description: 'Files that are not needed can be removed to save space.',
  },
  {
    key: 'localized_strings',
    name: 'Optimize localized strings',
    description: 'Localized string files can be optimized to reduce size.',
  },
  {
    key: 'localized_strings_minify',
    name: 'Minify localized strings',
    description: 'Localized string comments can be minified to reduce size.',
  },
  {
    key: 'small_files',
    name: 'Optimize small files',
    description: 'Small files can be optimized or bundled to reduce overhead.',
  },
  {
    key: 'hermes_debug_info',
    name: 'Remove Hermes debug info',
    description: 'Hermes debug information can be removed to reduce size.',
  },
  {
    key: 'audio_compression',
    name: 'Compress audio files',
    description: 'Audio files can be compressed to reduce size.',
  },
  {
    key: 'video_compression',
    name: 'Compress video files',
    description: 'Video files can be compressed to reduce size.',
  },
];

/**
 * Process all insights into a standardized format for display
 */
export function processInsights(
  insights: AppleInsightResults,
  totalSize: number
): ProcessedInsight[] {
  const processedInsights: ProcessedInsight[] = [];

  if (insights.image_optimization?.total_savings) {
    const insight = insights.image_optimization;
    const config = INSIGHT_CONFIGS.find(c => c.key === 'image_optimization');
    if (config) {
      const optimizableFiles = Array.isArray(insight.optimizable_files)
        ? insight.optimizable_files
        : [];

      processedInsights.push({
        name: config.name,
        description: config.description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: optimizableFiles.map((file: OptimizableImageFile) => {
          const maxSavings = Math.max(
            file.minify_savings || 0,
            file.conversion_savings || 0
          );
          return {
            path: file.file_path,
            savings: maxSavings,
            percentage: (maxSavings / totalSize) * 100,
            data: {
              fileType: 'optimizable_image' as const,
              minifyPercentage: ((file.minify_savings || 0) / totalSize) * 100,
              conversionPercentage: ((file.conversion_savings || 0) / totalSize) * 100,
              originalFile: file,
            },
          };
        }),
      });
    }
  }

  if (insights.duplicate_files?.total_savings) {
    const insight = insights.duplicate_files as GroupsInsightResult;
    const config = INSIGHT_CONFIGS.find(c => c.key === 'duplicate_files');
    if (config) {
      const groups = Array.isArray(insight.groups) ? insight.groups : [];

      processedInsights.push({
        name: config.name,
        description: config.description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: groups.flatMap((group: FileSavingsResultGroup) => {
          const files = Array.isArray(group?.files) ? group.files : [];
          return files.map((file: FileSavingsResult) => ({
            path: file.file_path,
            savings: file.total_savings,
            percentage: (file.total_savings / totalSize) * 100,
            data: {
              fileType: 'regular' as const,
              originalFile: file,
            },
          }));
        }),
      });
    }
  }

  if (insights.strip_binary?.total_savings) {
    const insight = insights.strip_binary;
    const config = INSIGHT_CONFIGS.find(c => c.key === 'strip_binary');
    if (config) {
      const files = Array.isArray(insight.files) ? insight.files : [];

      processedInsights.push({
        name: config.name,
        description: config.description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: files.map((file: StripBinaryFileInfo) => ({
          path: file.file_path,
          savings: file.total_savings,
          percentage: (file.total_savings / totalSize) * 100,
          data: {
            fileType: 'strip_binary' as const,
            originalFile: file,
          },
        })),
      });
    }
  }

  if (insights.loose_images?.total_savings) {
    const insight = insights.loose_images as GroupsInsightResult;
    const config = INSIGHT_CONFIGS.find(c => c.key === 'loose_images');
    if (config) {
      const groups = Array.isArray(insight.groups) ? insight.groups : [];

      processedInsights.push({
        name: config.name,
        description: config.description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: groups.flatMap((group: FileSavingsResultGroup) => {
          const files = Array.isArray(group?.files) ? group.files : [];
          return files.map((file: FileSavingsResult) => ({
            path: file.file_path,
            savings: file.total_savings,
            percentage: (file.total_savings / totalSize) * 100,
            data: {
              fileType: 'regular' as const,
              originalFile: file,
            },
          }));
        }),
      });
    }
  }

  const regularInsightKeys = [
    'main_binary_exported_symbols',
    'large_images',
    'large_videos',
    'large_audio',
    'unnecessary_files',
    'localized_strings',
    'localized_strings_minify',
    'small_files',
    'hermes_debug_info',
    'audio_compression',
    'video_compression',
  ] as const;

  regularInsightKeys.forEach(key => {
    const insight = insights[key] as FilesInsightResult | undefined;
    if (insight?.total_savings) {
      const config = INSIGHT_CONFIGS.find(c => c.key === key);
      if (config) {
        const files = Array.isArray(insight.files) ? insight.files : [];
        processedInsights.push({
          name: config.name,
          description: config.description,
          totalSavings: insight.total_savings,
          percentage: (insight.total_savings / totalSize) * 100,
          files: files.map((file: FileSavingsResult) => ({
            path: file.file_path,
            savings: file.total_savings,
            percentage: (file.total_savings / totalSize) * 100,
            data: {
              fileType: 'regular' as const,
              originalFile: file,
            },
          })),
        });
      }
    }
  });

  processedInsights.sort((a, b) => b.totalSavings - a.totalSavings);

  return processedInsights;
}
