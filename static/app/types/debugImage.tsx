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
  has_sources = 'has_sources',
  has_debug_info = 'has_debug_info',
  has_unwind_info = 'has_unwind_info',
  has_symbols = 'has_symbols',
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
  [ImageFeature.has_sources]: boolean;
  [ImageFeature.has_debug_info]: boolean;
  [ImageFeature.has_unwind_info]: boolean;
  [ImageFeature.has_symbols]: boolean;
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
  location: string;
  source: string;
  source_name?: string;
}

type InternalSource = {
  cpuName: string;
  dateCreated: string;
  fileType: string | null;
  filename: string;
  location: string;
  size: number;
  symbolType: SymbolType;
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
  location: string;
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
  candidates: Array<ImageCandidate>;
  features: ImageFeatures;
  type: string;
  arch?: string;
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
