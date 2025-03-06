// Candidate Processing Info
export enum CandidateProcessingStatus {
  OK = 'ok',
  MALFORMED = 'malformed',
  ERROR = 'error',
}

export enum SymbolType {
  UNKNOWN = 'unknown',
  BREAKPAD = 'breakpad',
  ELF = 'elf',
  MACHO = 'macho',
  PDB = 'pdb',
  PE = 'pe',
  SOURCEBUNDLE = 'sourcebundle',
  WASM = 'wasm',
  PROGUARD = 'proguard',
}

export enum ImageFeature {
  HAS_SOURCES = 'has_sources',
  HAS_DEBUG_INFO = 'has_debug_info',
  HAS_UNWIND_INFO = 'has_unwind_info',
  HAS_SYMBOLS = 'has_symbols',
}

type CandidateProcessingInfoOkStatus = {
  status: CandidateProcessingStatus.OK;
};

type CandidateProcessingInfoOtherStatus = {
  status: CandidateProcessingStatus.MALFORMED | CandidateProcessingStatus.ERROR;
  details?: string;
};

export type CandidateProcessingInfo =
  | CandidateProcessingInfoOkStatus
  | CandidateProcessingInfoOtherStatus;

// Candidate Download Status
export enum CandidateDownloadStatus {
  OK = 'ok',
  MALFORMED = 'malformed',
  NOT_FOUND = 'notfound',
  ERROR = 'error',
  NO_PERMISSION = 'noperm',
  DELETED = 'deleted',
  UNAPPLIED = 'unapplied',
}

type ImageFeatures = {
  [ImageFeature.HAS_SOURCES]: boolean;
  [ImageFeature.HAS_DEBUG_INFO]: boolean;
  [ImageFeature.HAS_UNWIND_INFO]: boolean;
  [ImageFeature.HAS_SYMBOLS]: boolean;
};

type CandidateFeatures = ImageFeatures;

type CandidateDownloadOkStatus = {
  features: CandidateFeatures;
  status: CandidateDownloadStatus.OK;
  details?: string;
};

type CandidateDownloadDeletedStatus = {
  features: CandidateFeatures;
  status: CandidateDownloadStatus.DELETED;
  details?: string;
};

type CandidateDownloadNotFoundStatus = {
  status: CandidateDownloadStatus.NOT_FOUND;
  details?: string;
};

type CandidateDownloadUnAppliedStatus = {
  features: CandidateFeatures;
  status: CandidateDownloadStatus.UNAPPLIED;
};

type CandidateDownloadOtherStatus = {
  status:
    | CandidateDownloadStatus.MALFORMED
    | CandidateDownloadStatus.NO_PERMISSION
    | CandidateDownloadStatus.ERROR;
  details?: string;
};

export type CandidateDownload =
  | CandidateDownloadNotFoundStatus
  | CandidateDownloadOkStatus
  | CandidateDownloadDeletedStatus
  | CandidateDownloadUnAppliedStatus
  | CandidateDownloadOtherStatus;

interface ImageCandidateBase {
  source: string;
  location?: string;
  source_name?: string;
}

type InternalSource = {
  dateCreated: string;
  filename: string;
  prettyFileType: string;
  size: number;
  symbolType: SymbolType;
  location?: string;
};

export interface ImageCandidateOk extends ImageCandidateBase {
  download: CandidateDownloadOkStatus;
  debug?: CandidateProcessingInfo;
  unwind?: CandidateProcessingInfo;
}

export interface ImageCandidateInternalOk extends ImageCandidateBase, InternalSource {
  download: CandidateDownloadOkStatus;
  debug?: CandidateProcessingInfo;
  unwind?: CandidateProcessingInfo;
}

export interface ImageCandidateUnApplied extends ImageCandidateBase, InternalSource {
  download: CandidateDownloadUnAppliedStatus;
  source: string;
  source_name?: string;
}

interface ImageCandidateOthers extends ImageCandidateBase {
  download:
    | CandidateDownloadNotFoundStatus
    | CandidateDownloadDeletedStatus
    | CandidateDownloadOtherStatus;
  source: string;
  source_name?: string;
}

export type ImageCandidate =
  | ImageCandidateOk
  | ImageCandidateInternalOk
  | ImageCandidateUnApplied
  | ImageCandidateOthers;

// Debug Status
export enum ImageStatus {
  FOUND = 'found',
  UNUSED = 'unused',
  MISSING = 'missing',
  MALFORMED = 'malformed',
  FETCHING_FAILED = 'fetching_failed',
  TIMEOUT = 'timeout',
  OTHER = 'other',
}

export type Image = {
  features: ImageFeatures;
  type: string;
  arch?: string;
  candidates?: ImageCandidate[];
  code_file?: string | null;
  code_id?: string;
  debug_file?: string;
  debug_id?: string;
  debug_status?: ImageStatus | null;
  image_addr?: string;
  image_size?: number;
  image_vmaddr?: string;
  unwind_status?: ImageStatus | null;
  uuid?: string;
};

export interface ImageWithCombinedStatus extends Image {
  /**
   * This is not returned from any API but is derived from debug and unwind status
   */
  status: ImageStatus;
}
