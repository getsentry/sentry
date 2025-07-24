export interface AppSizeApiResponse {
  generated_at: string;
  treemap: TreemapResults;
}

export interface TreemapResults {
  category_breakdown: Record<string, Record<string, number>>;
  file_count: number;
  platform: 'ios' | 'android';
  root: TreemapElement;
  total_download_size: number;
  total_install_size: number;
}

export interface TreemapElement {
  children: TreemapElement[];
  details: Record<string, unknown>;
  download_size: number;
  install_size: number;
  is_directory: boolean;
  name: string;
  element_type?: TreemapType;
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
