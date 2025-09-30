/**
 * API response types
 */

import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export interface AppSizeApiResponse {
  generated_at: string;
  treemap: TreemapResults;
  insights?: AppleInsightResults;
}

// Keep in sync with https://github.com/getsentry/sentry/blob/a85090d7b81832982b43a35c30db9970a0258e99/src/sentry/preprod/models.py#L382
export enum SizeAnalysisComparisonState {
  PENDING = 0,
  PROCESSING = 1,
  SUCCESS = 2,
  FAILED = 3,
}

interface SizeAnalysisComparison {
  base_size_metric_id: number;
  comparison_id: number | null;
  error_code: string | null;
  error_message: string | null;
  head_size_metric_id: number;
  identifier: string;
  metrics_artifact_type: MetricsArtifactType;
  state: SizeAnalysisComparisonState;
}

export interface SizeComparisonApiResponse {
  base_build_details: BuildDetailsApiResponse;
  comparisons: SizeAnalysisComparison[];
  head_build_details: BuildDetailsApiResponse;
}

/**
 * App size result types (saved in JSON)
 * Keep in sync with https://github.com/getsentry/sentry/blob/a85090d7b81832982b43a35c30db9970a0258e99/src/sentry/preprod/size_analysis/models.py#L8
 */

export interface TreemapResults {
  category_breakdown: Record<string, Record<string, number>>;
  file_count: number;
  platform: 'ios' | 'android';
  root: TreemapElement;
}

export interface TreemapElement {
  children: TreemapElement[];
  is_dir: boolean;
  name: string;
  size: number;
  type: TreemapType;
  path?: string;
}

export enum TreemapType {
  // Generic file categories (cross-platform)
  FILES = 'files',
  EXECUTABLES = 'executables',
  RESOURCES = 'resources',
  ASSETS = 'assets',
  MANIFESTS = 'manifests',
  SIGNATURES = 'signatures',
  FONTS = 'fonts',

  // iOS-specific categories
  FRAMEWORKS = 'frameworks',
  PLISTS = 'plists',
  EXTENSIONS = 'extensions',

  // Android-specific categories
  DEX = 'dex',
  NATIVE_LIBRARIES = 'native_libraries',
  COMPILED_RESOURCES = 'compiled_resources',

  // Binary analysis categories (cross-platform)
  MODULES = 'modules',
  CLASSES = 'classes',
  METHODS = 'methods',
  STRINGS = 'strings',
  SYMBOLS = 'symbols',

  // iOS binary categories
  DYLD = 'dyld',
  MACHO = 'macho',
  FUNCTION_STARTS = 'function_starts',
  CODE_SIGNATURE = 'code_signature',
  EXTERNAL_METHODS = 'external_methods',

  // Binary section categories
  BINARY = 'binary',

  // Generic categories
  OTHER = 'other',
  UNMAPPED = 'unmapped',
}

// Insights Types

interface BaseInsightResult {
  total_savings: number;
}

export interface FileSavingsResult {
  file_path: string;
  total_savings: number;
}

export interface FileSavingsResultGroup {
  files: FileSavingsResult[];
  name: string;
  total_savings: number;
}

export interface FilesInsightResult extends BaseInsightResult {
  files: FileSavingsResult[];
}

export interface GroupsInsightResult extends BaseInsightResult {
  groups: FileSavingsResultGroup[];
}

interface DuplicateFilesInsightResult extends GroupsInsightResult {}

interface LargeImageFileInsightResult extends FilesInsightResult {}

interface LargeVideoFileInsightResult extends FilesInsightResult {}

interface LargeAudioFileInsightResult extends FilesInsightResult {}

interface HermesDebugInfoInsightResult extends FilesInsightResult {}

interface UnnecessaryFilesInsightResult extends FilesInsightResult {}

interface LocalizedStringInsightResult extends FilesInsightResult {}

interface LocalizedStringCommentsInsightResult extends FilesInsightResult {}

interface SmallFilesInsightResult extends FilesInsightResult {}

interface LooseImagesInsightResult extends GroupsInsightResult {}

interface MainBinaryExportMetadataResult extends FilesInsightResult {}

export interface OptimizableImageFile {
  conversion_savings: number;
  current_size: number;
  file_path: string;
  heic_size: number | null;
  minified_size: number | null;
  minify_savings: number;
}

interface ImageOptimizationInsightResult extends BaseInsightResult {
  optimizable_files: OptimizableImageFile[];
}

export interface StripBinaryFileInfo {
  debug_sections_savings: number;
  file_path: string;
  symbol_table_savings: number;
  total_savings: number;
}

interface StripBinaryInsightResult extends BaseInsightResult {
  files: StripBinaryFileInfo[];
  total_debug_sections_savings: number;
  total_symbol_table_savings: number;
}

interface AudioCompressionInsightResult extends FilesInsightResult {}

interface VideoCompressionInsightResult extends FilesInsightResult {}

export interface AppleInsightResults {
  audio_compression?: AudioCompressionInsightResult;
  duplicate_files?: DuplicateFilesInsightResult;
  hermes_debug_info?: HermesDebugInfoInsightResult;
  image_optimization?: ImageOptimizationInsightResult;
  large_audio?: LargeAudioFileInsightResult;
  large_images?: LargeImageFileInsightResult;
  large_videos?: LargeVideoFileInsightResult;
  localized_strings?: LocalizedStringInsightResult;
  localized_strings_minify?: LocalizedStringCommentsInsightResult;
  loose_images?: LooseImagesInsightResult;
  main_binary_exported_symbols?: MainBinaryExportMetadataResult;
  small_files?: SmallFilesInsightResult;
  strip_binary?: StripBinaryInsightResult;
  unnecessary_files?: UnnecessaryFilesInsightResult;
  video_compression?: VideoCompressionInsightResult;
}

/**
 * App size comparison types (saved in JSON)
 * https://github.com/getsentry/sentry/blob/a85090d7b81832982b43a35c30db9970a0258e99/src/sentry/preprod/size_analysis/models.py#L40
 */

export type DiffType = 'added' | 'removed' | 'increased' | 'decreased';

export interface DiffItem {
  base_size: number | null;
  head_size: number | null;
  item_type: TreemapType | null;
  path: string;
  size_diff: number;
  type: DiffType;
}

// Keep in sync with https://github.com/getsentry/sentry/blob/a85090d7b81832982b43a35c30db9970a0258e99/src/sentry/preprod/models.py#L230
export enum MetricsArtifactType {
  MAIN_ARTIFACT = 0,
  WATCH_ARTIFACT = 1,
  ANDROID_DYNAMIC_FEATURE = 2,
}

interface SizeMetricDiffItem {
  base_download_size: number;
  base_install_size: number;
  head_download_size: number;
  head_install_size: number;
  identifier: string | null;
  metrics_artifact_type: MetricsArtifactType;
}

export interface SizeAnalysisComparisonResults {
  diff_items: DiffItem[];
  size_metric_diff_item: SizeMetricDiffItem;
}
