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
  unwind?: CandidateProcessingInfo;
  debug?: CandidateProcessingInfo;
};

type CandidateDownloadNotFoundStatus = {
  status: CandidateDownloadStatus.NOT_FOUND;
  details?: string;
};

type CandidateDownloadDeletedStatus = {
  status: CandidateDownloadStatus.DELETED;
};

type CandidateDownloadUnAppliedStatus = {
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

export type ImageCandidate = {
  download: CandidateDownload;
  source: string;
  source_name?: string;
  location?: string;
};

// Debug Status
export enum ImageProcessingInfo {
  FOUND = 'found',
  UNUSED = 'unused',
  MISSING = 'missing',
  MALFORMED = 'malformed',
  FETCHING_FAILED = 'fetching_failed',
  TIMEOUT = 'timeout',
  OTHER = 'other',
}

export type Image = {
  debug_file: string;
  debug_id: string;
  code_file: string;
  code_id: string;
  type: string;
  image_size: number;
  features: ImageFeatures;
  candidates: Array<ImageCandidate>;
  debug_status?: ImageProcessingInfo | null;
  unwind_status?: ImageProcessingInfo | null;
  arch?: string;
  image_addr?: string;
};
