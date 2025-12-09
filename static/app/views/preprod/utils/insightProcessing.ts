import {t} from 'sentry/locale';
import type {
  FileSavingsResult,
  FileSavingsResultGroup,
  FilesInsightResult,
  GroupsInsightResult,
  InsightResults,
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
    name: t('Image Optimization'),
    description: t(
      'We determine how much size could be reduced if images were better optimized. In some cases you can convert to HEIC for better compression.'
    ),
  },
  {
    key: 'webp_optimization',
    name: t('WebP Optimization'),
    description: t('Images can be converted to WebP to reduce size.'),
  },
  {
    key: 'duplicate_files',
    name: t('Duplicate Files'),
    description: t(
      'Multiple copies of the same file were found. Move these files to shared locations to reduce size.'
    ),
  },
  {
    key: 'strip_binary',
    name: t('Strip Binary Symbols'),
    description: t(
      'Debug symbols and symbol tables can be removed from production binaries to reduce size.'
    ),
  },
  {
    key: 'loose_images',
    name: t('Loose Images'),
    description: t('Loose image files can be moved to asset catalogs to reduce size.'),
  },
  {
    key: 'main_binary_exported_symbols',
    name: t('Main Binary Export Metadata'),
    description: t(
      'Symbol metadata can be removed from entrypoint binaries to reduce size.'
    ),
  },
  {
    key: 'large_images',
    name: t('Large Images'),
    description: t('Large image files can be removed or compressed to reduce size.'),
  },
  {
    key: 'large_videos',
    name: t('Large Videos'),
    description: t('Large video files can be removed or compressed to reduce size.'),
  },
  {
    key: 'large_audio',
    name: t('Large Audio'),
    description: t(
      'Size Analysis flags audio files over 5 MB. These files can often be compressed further, converted to a more efficient format, or excluded from the app bundle and instead downloaded dynamically as the user requires them.'
    ),
  },
  {
    key: 'unnecessary_files',
    name: t('Unnecessary Files'),
    description: t('Files that are not needed can be removed to reduce size.'),
  },
  {
    key: 'localized_strings_minify',
    name: t('Minify Localized Strings'),
    description: t('Localized string files can be minified to reduce size.'),
  },
  {
    key: 'small_files',
    name: t('Small Files'),
    description: t('Small files can be moved to asset catalogs to reduce size.'),
  },
  {
    key: 'hermes_debug_info',
    name: t('Hermes Debug Info'),
    description: t('Hermes debug information can be removed to reduce size.'),
  },
  {
    key: 'audio_compression',
    name: t('Audio Compression'),
    description: t('Audio files can be compressed to reduce size.'),
  },
  {
    key: 'video_compression',
    name: t('Video Compression'),
    description: t('Video files can be compressed to reduce size.'),
  },
  {
    key: 'alternate_icons_optimization',
    name: t('Alternate Icon Optimization'),
    description: t(
      "Alternate icons don't need full size quality because they are only shown downscaled in the homescreen."
    ),
  },
  {
    key: 'multiple_native_library_archs',
    name: t('Multiple native library architectures'),
    description: t(
      'Only one native library architecture is needed. Non-arm64 architectures can be removed.'
    ),
  },
];

export function getInsightConfig(insightType: string): InsightConfig {
  return (
    INSIGHT_CONFIGS.find(config => config.key === insightType) ?? {
      name: insightType,
      key: insightType,
      description: '',
    }
  );
}

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
  insights: InsightResults,
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
    'multiple_native_library_archs',
    'webp_optimization',
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
          files: files
            .sort((a, b) => b.total_savings - a.total_savings)
            .map((file: FileSavingsResult) => ({
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
