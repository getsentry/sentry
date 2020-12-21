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
export enum CandiateDownloadStatus {
  OK = 'ok',
  MALFORMED = 'malformed',
  NOT_FOUND = 'notfound',
  ERROR = 'error',
  NO_PERMISSION = 'noperm',
}

type Features = {
  has_sources: boolean;
  has_debug_info: boolean;
  has_unwind_info: boolean;
  has_symbols: boolean;
};

type CandidateDownloadOkStatus = {
  status: CandiateDownloadStatus.OK;
  features: Features;
  details?: string;
  unwind?: CandidateStacktraceInfo;
  debug?: CandidateStacktraceInfo;
};

type CandidateDownloadNotFoundStatus = {
  status: CandiateDownloadStatus.NOT_FOUND;
  details?: string;
};

type CandidateDownloadOtherStatus = {
  status:
    | CandiateDownloadStatus.MALFORMED
    | CandiateDownloadStatus.NO_PERMISSION
    | CandiateDownloadStatus.ERROR;
};

export type CandidateDownload =
  | CandidateDownloadNotFoundStatus
  | CandidateDownloadOkStatus
  | CandidateDownloadOtherStatus;

type Candidate = {
  download: CandidateDownload;
  location: string;
  source: string;
  source_name: string;
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
