import type {Platform} from './sharedTypes';

export interface BuildDetailsApiResponse {
  app_info: BuildDetailsAppInfo;
  state: BuildDetailsState;
  vcs_info: BuildDetailsVcsInfo;
  size_info?: BuildDetailsSizeInfo;
}

export interface BuildDetailsAppInfo {
  app_id: string;
  artifact_type: BuildDetailsArtifactType;
  build_number: string;
  date_added: string;
  date_built: string;
  is_installable: boolean;
  name: string;
  platform: Platform;
  version: string;
  // build_configuration?: string; // Uncomment when available
  // icon?: string | null; // Uncomment when available
}

interface BuildDetailsVcsInfo {
  commit_id: string | null;
  // repo?: string; // Uncomment when available
  // provider?: string; // Uncomment when available
  // branch?: string; // Uncomment when available
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
