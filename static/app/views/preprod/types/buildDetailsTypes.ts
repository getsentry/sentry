import type {Platform} from './sharedTypes';

export interface BuildDetailsApiResponse {
  app_info: BuildDetailsAppInfo;
  id: string;
  state: BuildDetailsState;
  vcs_info: BuildDetailsVcsInfo;
  size_info?: BuildDetailsSizeInfo;
}

export interface BuildDetailsAppInfo {
  app_id?: string | null;
  artifact_type?: BuildDetailsArtifactType | null;
  build_configuration?: string | null;
  build_number?: string | null;
  date_added?: string;
  date_built?: string | null;
  is_installable?: boolean;
  name?: string | null;
  platform?: Platform | null;
  version?: string | null;
}

interface BuildDetailsVcsInfo {
  base_ref?: string | null;
  base_repo_name?: string | null;
  base_sha?: string | null;
  head_ref?: string | null;
  head_repo_name?: string | null;
  head_sha?: string | null;
  pr_number?: number | null;
  provider?: string | null;
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

export function isSizeInfoProcessing(
  sizeInfo: BuildDetailsSizeInfo | undefined
): boolean {
  return (
    sizeInfo?.state === BuildDetailsSizeAnalysisState.PENDING ||
    sizeInfo?.state === BuildDetailsSizeAnalysisState.PROCESSING
  );
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
