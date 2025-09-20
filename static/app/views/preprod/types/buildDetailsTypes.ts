import type {Platform} from './sharedTypes';

export interface BuildDetailsApiResponse {
  app_info: BuildDetailsAppInfo;
  id: string;
  state: BuildDetailsState;
  vcs_info: BuildDetailsVcsInfo;
  size_info?: BuildDetailsSizeInfo;
}

export interface BuildDetailsAppInfo {
  app_id?: string;
  artifact_type?: BuildDetailsArtifactType;
  build_configuration?: string;
  build_number?: string;
  date_added?: string;
  date_built?: string;
  is_installable?: boolean;
  name?: string;
  platform?: Platform;
  version?: string;
}

interface BuildDetailsVcsInfo {
  base_ref?: string;
  base_repo_name?: string;
  base_sha?: string;
  head_ref?: string;
  head_repo_name?: string;
  head_sha?: string;
  pr_number?: number;
  provider?: 'github';
}

interface BuildDetailsSizeInfoPending {
  state: BuildDetailsSizeAnalysisState.PENDING;
}

interface BuildDetailsSizeInfoProcessing {
  state: BuildDetailsSizeAnalysisState.PROCESSING;
}

interface BuildDetailsSizeInfoCompleted {
  download_size_bytes: number;
  install_size_bytes: number;
  state: BuildDetailsSizeAnalysisState.COMPLETED;
}

interface BuildDetailsSizeInfoFailed {
  error_code: number;
  error_message: string;
  state: BuildDetailsSizeAnalysisState.FAILED;
}

export type BuildDetailsSizeInfo =
  | BuildDetailsSizeInfoPending
  | BuildDetailsSizeInfoProcessing
  | BuildDetailsSizeInfoCompleted
  | BuildDetailsSizeInfoFailed;

export function isSizeInfoCompleted(
  sizeInfo: BuildDetailsSizeInfo | undefined
): sizeInfo is BuildDetailsSizeInfoCompleted {
  return sizeInfo?.state === BuildDetailsSizeAnalysisState.COMPLETED;
}

export enum BuildDetailsState {
  UPLOADING = 0,
  UPLOADED = 1,
  PROCESSED = 3,
  FAILED = 4,
}

export enum BuildDetailsArtifactType {
  XCARCHIVE = 0,
  AAB = 1,
  APK = 2,
}

export enum BuildDetailsSizeAnalysisState {
  PENDING = 0,
  PROCESSING = 1,
  COMPLETED = 2,
  FAILED = 3,
}
