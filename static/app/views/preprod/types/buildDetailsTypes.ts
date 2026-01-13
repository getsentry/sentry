/* eslint-disable typescript-sort-keys/interface */
import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';

import type {Platform} from './sharedTypes';

export interface BuildDetailsApiResponse {
  app_info: BuildDetailsAppInfo;
  distribution_info: BuildDetailsDistributionInfo;
  id: string;
  project_id: number;
  project_slug: string;
  state: BuildDetailsState;
  vcs_info: BuildDetailsVcsInfo;
  size_info?: BuildDetailsSizeInfo;
  posted_status_checks?: PostedStatusChecks | null;
  base_artifact_id?: string | null;
  base_build_info?: BuildDetailsAppInfo | null;
}

interface BuildDetailsDistributionInfo {
  is_installable: boolean;
  download_count: number;
  release_notes: string | null;
}

export interface BuildDetailsAppInfo {
  app_icon_id?: string | null;
  android_app_info?: AndroidAppInfo | null;
  app_id?: string | null;
  apple_app_info?: AppleAppInfo | null;
  artifact_type?: BuildDetailsArtifactType | null;
  build_configuration?: string | null;
  build_number?: string | null;
  date_added?: string;
  date_built?: string | null;
  name?: string | null;
  platform?: Platform | null;
  version?: string | null;
}

interface AppleAppInfo {
  has_missing_dsym_binaries?: boolean;
}

interface AndroidAppInfo {
  has_proguard_mapping?: boolean;
}

export interface BuildDetailsVcsInfo {
  base_ref?: string | null;
  base_repo_name?: string | null;
  base_sha?: string | null;
  head_ref?: string | null;
  head_repo_name?: string | null;
  head_sha?: string | null;
  pr_number?: number | null;
  provider?: string | null;
}

export interface BuildDetailsSizeInfoSizeMetric {
  metrics_artifact_type: MetricsArtifactType;
  install_size_bytes: number;
  download_size_bytes: number;
}

interface BuildDetailsSizeInfoPending {
  state: BuildDetailsSizeAnalysisState.PENDING;
}

interface BuildDetailsSizeInfoProcessing {
  state: BuildDetailsSizeAnalysisState.PROCESSING;
}

interface BuildDetailsSizeInfoCompleted {
  state: BuildDetailsSizeAnalysisState.COMPLETED;
  size_metrics: BuildDetailsSizeInfoSizeMetric[];
  base_size_metrics: BuildDetailsSizeInfoSizeMetric[];
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

export function getMainArtifactSizeMetric(
  sizeInfo: BuildDetailsSizeInfoCompleted
): BuildDetailsSizeInfoSizeMetric | undefined {
  return sizeInfo.size_metrics.find(
    metric => metric.metrics_artifact_type === MetricsArtifactType.MAIN_ARTIFACT
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

interface PostedStatusChecks {
  size?: StatusCheckResult | null;
}

export type StatusCheckResult = StatusCheckResultSuccess | StatusCheckResultFailure;

interface StatusCheckResultSuccess {
  success: true;
  check_id?: string | null;
}

interface StatusCheckResultFailure {
  success: false;
  error_type?: StatusCheckErrorType | null;
}

export enum StatusCheckErrorType {
  UNKNOWN = 'unknown',
  API_ERROR = 'api_error',
  INTEGRATION_ERROR = 'integration_error',
}

export function isStatusCheckSuccess(
  result: StatusCheckResult | undefined | null
): result is StatusCheckResultSuccess {
  return result?.success === true;
}

export function isStatusCheckFailure(
  result: StatusCheckResult | undefined | null
): result is StatusCheckResultFailure {
  return result?.success === false;
}
