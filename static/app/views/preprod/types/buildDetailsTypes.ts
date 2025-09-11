import type {Platform} from './sharedTypes';

export interface BuildDetailsApiResponse {
  app_info: BuildDetailsAppInfo;
  id: string;
  state: BuildDetailsState;
  vcs_info: BuildDetailsVcsInfo;
  size_analysis_state?: BuildDetailsSizeAnalysisState;
  size_info?: BuildDetailsSizeInfo;
}

export interface BuildDetailsAppInfo {
  app_id?: string;
  artifact_type?: BuildDetailsArtifactType;
  build_number?: string;
  date_added?: string;
  date_built?: string;
  is_installable?: boolean;
  name?: string;
  platform?: Platform;
  version?: string;
  // build_configuration?: string; // Uncomment when available
  // icon?: string | null; // Uncomment when available
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

export interface BuildDetailsSizeInfo {
  download_size_bytes: number;
  install_size_bytes: number;
}

enum BuildDetailsState {
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
