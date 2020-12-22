// Candidate Stacktrace Info
export enum CandidateStacktraceStatus {
  OK = 'ok',
  MALFORMED = 'malformed',
  ERROR = 'error',
}

type CandidateStacktraceInfoOkStatus = {
  status: CandidateStacktraceStatus.OK;
};

type CandidateStacktraceInfoOtherStatus = {
  status: CandidateStacktraceStatus.MALFORMED | CandidateStacktraceStatus.ERROR;
  details?: string;
};

export type CandidateStacktraceInfo =
  | CandidateStacktraceInfoOkStatus
  | CandidateStacktraceInfoOtherStatus;

// Candidate Download Status
export enum CandidateDownloadStatus {
  OK = 'ok',
  MALFORMED = 'malformed',
  NOT_FOUND = 'notfound',
  ERROR = 'error',
  NO_PERMISSION = 'noperm',
  DELETED = 'deleted',
}

type Features = {
  has_sources: boolean;
  has_debug_info: boolean;
  has_unwind_info: boolean;
  has_symbols: boolean;
};

type CandidateDownloadOkStatus = {
  status: CandidateDownloadStatus.OK;
  features: Features;
  details?: string;
  unwind?: CandidateStacktraceInfo;
  debug?: CandidateStacktraceInfo;
};

type CandidateDownloadNotFoundStatus = {
  status: CandidateDownloadStatus.NOT_FOUND;
  details?: string;
};

type CandidateDownloadDeletedStatus = {
  status: CandidateDownloadStatus.DELETED;
  details: string;
};

type CandidateDownloadOtherStatus = {
  status:
    | CandidateDownloadStatus.MALFORMED
    | CandidateDownloadStatus.NO_PERMISSION
    | CandidateDownloadStatus.ERROR;
};

export type CandidateDownload =
  | CandidateDownloadNotFoundStatus
  | CandidateDownloadOkStatus
  | CandidateDownloadDeletedStatus
  | CandidateDownloadOtherStatus;

type Candidate = {
  download: CandidateDownload;
  source: string;
  source_name?: string;
  location?: string;
};

// Debug Status
export enum ImageStackTraceInfo {
  FOUND = 'found',
  UNUSED = 'unused',
  MISSING = 'missing',
  MALFORMED = 'malformed',
  TIMEOUT = 'timeout',
  FETCHING_FAILED = 'fetching_failed',
  OTHER = 'other',
}

export type Image = {
  debug_file: string;
  debug_id: string;
  code_file: string;
  code_id: string;
  type: string;
  image_size: number;
  debug_status: ImageStackTraceInfo;
  unwind_status: ImageStackTraceInfo;
  features: Features;
  candidates: Array<Candidate>;
  arch?: string;
  image_addr?: string;
};
