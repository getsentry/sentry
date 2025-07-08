/**
 * TypeScript types for size analysis treemap visualization
 */

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

  // Generic categories
  OTHER = 'other',
  UNMAPPED = 'unmapped',
}

export interface TreemapElement {
  /** Child elements */
  children: TreemapElement[];
  /** Platform and context-specific metadata */
  details: Record<string, unknown>;
  /** Download size in bytes (compressed) */
  download_size: number;
  /** Install size in bytes */
  install_size: number;
  /** Whether this element represents a directory */
  is_directory: boolean;
  /** Display name of the element */
  name: string;
  /** Type of element for visualization */
  element_type?: TreemapType;
  /** File or directory path */
  path?: string;
}

interface TreemapResults {
  /** Size breakdown by category */
  category_breakdown: Record<string, Record<string, number>>;
  /** Total number of files analyzed */
  file_count: number;
  /** Platform (ios, android, etc.) */
  platform: 'ios' | 'android';
  /** Root element of the treemap */
  root: TreemapElement;
  /** Total download size */
  total_download_size: number;
  /** Total install size */
  total_install_size: number;
}

export interface EChartsTreemapData {
  name: string;
  value: number;
  children?: EChartsTreemapData[];
  itemStyle?: {
    borderColor?: string;
    borderWidth?: number;
    color?: string;
    gapWidth?: number;
  };
  label?: {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    padding?: number;
    position?: string;
    show?: boolean;
    textShadowBlur?: number;
    textShadowColor?: string;
    textShadowOffsetY?: number;
  };
  upperLabel?: {
    backgroundColor?: string;
    borderRadius?: number[];
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    height?: number;
    padding?: number;
    show?: boolean;
    textShadowBlur?: number;
    textShadowColor?: string;
    textShadowOffsetY?: number;
  };
}

// File analysis format interfaces
interface FileAnalysisFile {
  file_type: string;
  hash_md5: string;
  path: string;
  size: number;
}

interface FileAnalysisData {
  file_count: number;
  files_by_type: Record<string, FileAnalysisFile[]>;
  largest_files: FileAnalysisFile[];
  total_size: number;
}

interface AppInfo {
  build: string;
  bundle_id: string;
  executable: string;
  name: string;
  version: string;
}

export interface FileAnalysisReport {
  app_info: AppInfo;
  file_analysis: FileAnalysisData;
  generated_at: string;
  treemap: TreemapResults;
  use_si_units: boolean;
  binary_analysis?: {
    [key: string]: unknown;
    executable_size: number;
  };
}
