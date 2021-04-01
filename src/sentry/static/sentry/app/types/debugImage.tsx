// Candidate Processing Info
export enum CandidateProcessingStatus {
  OK = 'ok',
  MALFORMED = 'malformed',
  ERROR = 'error',
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
  has_sources: boolean;
  has_debug_info: boolean;
  has_unwind_info: boolean;
  has_symbols: boolean;
};

export type CandidateFeatures = ImageFeatures;

type CandidateDownloadOkStatus = {
  status: CandidateDownloadStatus.OK;
  features: CandidateFeatures;
  details?: string;
};

type CandidateDownloadDeletedStatus = {
  status: CandidateDownloadStatus.DELETED;
  features: CandidateFeatures;
  details?: string;
};

type CandidateDownloadNotFoundStatus = {
  status: CandidateDownloadStatus.NOT_FOUND;
  details?: string;
};

type CandidateDownloadUnAppliedStatus = {
  status: CandidateDownloadStatus.UNAPPLIED;
  features: CandidateFeatures;
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

type ImageCandidateBase = {
  source: string;
  source_name?: string;
  location?: string;
};

export type ImageCandidateOk = ImageCandidateBase & {
  download: CandidateDownloadOkStatus;
  unwind?: CandidateProcessingInfo;
  debug?: CandidateProcessingInfo;
  filename?: string;
};

export type ImageCandidateUnApplied = ImageCandidateBase & {
  download: CandidateDownloadUnAppliedStatus;
  filename: string;
  symbolType: string;
  fileType: string | null;
  cpuName: string;
  size: number;
  dateCreated: string;
  source: string;
  source_name?: string;
  location?: string;
};

type ImageCandidateOthers = ImageCandidateBase & {
  download:
    | CandidateDownloadNotFoundStatus
    | CandidateDownloadDeletedStatus
    | CandidateDownloadOtherStatus;
  source: string;
  source_name?: string;
  location?: string;
};

export type ImageCandidate =
  | ImageCandidateOk
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
  type: string;
  features: ImageFeatures;
  candidates: Array<ImageCandidate>;
  image_size?: number;
  debug_file?: string;
  code_file?: string | null;
  code_id?: string;
  debug_id?: string;
  debug_status?: ImageStatus | null;
  unwind_status?: ImageStatus | null;
  arch?: string;
  image_addr?: string;
  uuid?: string;
};
