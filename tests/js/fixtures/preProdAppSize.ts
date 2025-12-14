import type {InsightResults} from 'sentry/views/preprod/types/appSizeTypes';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

export function ProcessedInsightFixture(
  params: Partial<ProcessedInsight> = {}
): ProcessedInsight {
  return {
    key: 'duplicate_files',
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
        savings: 128000,
        percentage: 2.0,
        data: {
          fileType: 'optimizable_image' as const,
          minifyPercentage: 0,
          conversionPercentage: 2.0,
          isDuplicateVariant: false,
          originalFile: {
            file_path: 'src/assets/logo.png',
            current_size: 256000,
            minify_savings: 0,
            minified_size: null,
            conversion_savings: 128000,
            heic_size: 128000,
            colorspace: null,
            idiom: null,
          },
        },
      },
    ],
    ...params,
  };
}

export function InsightResultsFixture(
  params: Partial<InsightResults> = {}
): InsightResults {
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
