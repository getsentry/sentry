export interface AppSizeApiResponse {
  generated_at: string;
  treemap: TreemapResults;
  insights?: AppleInsightResults;
}

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
  best_optimization_type: 'convert_to_heic' | 'minify' | 'none';
  conversion_savings: number;
  current_size: number;
  file_path: string;
  heic_size: number | null;
  minified_size: number | null;
  minify_savings: number;
  potential_savings: number;
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
