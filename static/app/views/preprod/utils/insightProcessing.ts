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
      isDuplicateVariant: boolean;
      minifyPercentage: number;
      originalFile: OptimizableImageFile;
    }
  | {fileType: 'strip_binary'; originalFile: StripBinaryFileInfo}
  | {fileType: 'duplicate_files'; originalGroup: FileSavingsResultGroup}
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
  key: string;
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
    name: 'Image Optimization',
    description:
      'We determine how much size could be reduced if images were better optimized. In some cases you can convert to HEIC for better compression.',
  },
  {
    key: 'duplicate_files',
    name: 'Duplicate Files',
    description:
      'Multiple copies of the same file were found. Move these files to shared locations to reduce size.',
  },
  {
    key: 'strip_binary',
    name: 'Strip Binary Symbols',
    description:
      'Debug symbols and symbol tables can be removed from production binaries to reduce size.',
  },
  {
    key: 'loose_images',
    name: 'Loose Images',
    description: 'Loose image files can be moved to asset catalogs to reduce size.',
  },
  {
    key: 'main_binary_exported_symbols',
    name: 'Main Binary Export Metadata',
    description:
      'Symbol metadata can be removed from entrypoint binaries to reduce size.',
  },
  {
    key: 'large_images',
    name: 'Large Images',
    description: 'Large image files can be removed or compressed to reduce size.',
  },
  {
    key: 'large_videos',
    name: 'Large Videos',
    description: 'Large video files can be removed or compressed to reduce size.',
  },
  {
    key: 'large_audio',
    name: 'Large Audio',
    description: 'Large audio files can be removed or compressed to reduce size.',
  },
  {
    key: 'unnecessary_files',
    name: 'Unnecessary Files',
    description: 'Files that are not needed can be removed to reduce size.',
  },
  {
    key: 'localized_strings_minify',
    name: 'Minify Localized Strings',
    description: 'Localized string files can be minified to reduce size.',
  },
  {
    key: 'small_files',
    name: 'Small Files',
    description: 'Small files can be moved to asset catalogs to reduce size.',
  },
  {
    key: 'hermes_debug_info',
    name: 'Hermes Debug Info',
    description: 'Hermes debug information can be removed to reduce size.',
  },
  {
    key: 'audio_compression',
    name: 'Audio Compression',
    description: 'Audio files can be compressed to reduce size.',
  },
  {
    key: 'video_compression',
    name: 'Video Compression',
    description: 'Video files can be compressed to reduce size.',
  },
  {
    key: 'alternate_icons_optimization',
    name: 'Alternate Icon Optimization',
    description:
      'Alternate icons don’t need full size quality because they are only shown downscaled in the homescreen.',
  },
];

function markDuplicateImageVariants(processedInsights: ProcessedInsight[]): void {
  const imageInsightTypes = ['image_optimization', 'alternate_icons_optimization'];
  for (const insight of processedInsights) {
    if (!imageInsightTypes.includes(insight.key)) {
      continue;
    }

    const filePathOccurrences = new Map<string, number>();
    for (const file of insight.files) {
      const currentCount = filePathOccurrences.get(file.path) || 0;
      filePathOccurrences.set(file.path, currentCount + 1);
    }

    for (const file of insight.files) {
      if (file.data.fileType !== 'optimizable_image') {
        continue;
      }

      const occurrences = filePathOccurrences.get(file.path) || 0;
      if (occurrences > 1) {
        file.data.isDuplicateVariant = true;
      }
    }
  }
}

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
        key: config.key,
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
              isDuplicateVariant: false,
            },
          };
        }),
      });
    }
  }

  if (insights.alternate_icons_optimization?.total_savings) {
    const insight = insights.alternate_icons_optimization;
    const config = INSIGHT_CONFIGS.find(c => c.key === 'alternate_icons_optimization');
    if (config) {
      const optimizableFiles = Array.isArray(insight.optimizable_files)
        ? insight.optimizable_files
        : [];

      processedInsights.push({
        key: config.key,
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
              isDuplicateVariant: false,
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
        key: config.key,
        name: config.name,
        description: config.description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: groups.map((group: FileSavingsResultGroup) => ({
          path: group.name,
          savings: group.total_savings,
          percentage: (group.total_savings / totalSize) * 100,
          data: {
            fileType: 'duplicate_files' as const,
            originalGroup: group,
          },
        })),
      });
    }
  }

  if (insights.strip_binary?.total_savings) {
    const insight = insights.strip_binary;
    const config = INSIGHT_CONFIGS.find(c => c.key === 'strip_binary');
    if (config) {
      const files = Array.isArray(insight.files) ? insight.files : [];

      processedInsights.push({
        key: config.key,
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
        key: config.key,
        name: config.name,
        description: config.description,
        totalSavings: insight.total_savings,
        percentage: (insight.total_savings / totalSize) * 100,
        files: groups.map((group: FileSavingsResultGroup) => ({
          path: group.name,
          savings: group.total_savings,
          percentage: (group.total_savings / totalSize) * 100,
          data: {
            fileType: 'duplicate_files' as const,
            originalGroup: group,
          },
        })),
      });
    }
  }

  const regularInsightKeys = [
    'main_binary_exported_symbols',
    'large_images',
    'large_videos',
    'large_audio',
    'unnecessary_files',
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
          key: config.key,
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

  markDuplicateImageVariants(processedInsights);
  processedInsights.sort((a, b) => b.totalSavings - a.totalSavings);

  return processedInsights;
}
