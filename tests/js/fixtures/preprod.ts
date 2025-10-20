import type {
  BuildDetailsApiResponse,
  BuildDetailsAppInfo,
  BuildDetailsVcsInfo,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  BuildDetailsArtifactType,
  BuildDetailsSizeAnalysisState,
  BuildDetailsState,
} from 'sentry/views/preprod/types/buildDetailsTypes';

export function PreprodAppInfoFixture(
  params: Partial<BuildDetailsAppInfo> = {}
): BuildDetailsAppInfo {
  return {
    version: '1.0.0',
    build_number: '123',
    name: 'Test App',
    app_id: null,
    artifact_type: null,
    build_configuration: null,
    date_added: undefined,
    date_built: null,
    is_installable: undefined,
    platform: null,
    ...params,
  };
}

export function PreprodVcsInfoFixture(
  params: Partial<BuildDetailsVcsInfo> = {}
): BuildDetailsVcsInfo {
  return {
    head_sha: 'abc123',
    base_sha: null,
    head_ref: null,
    base_ref: null,
    head_repo_name: null,
    base_repo_name: null,
    pr_number: null,
    provider: null,
    ...params,
  };
}

export function PreprodVcsInfoFullFixture(
  params: Partial<BuildDetailsVcsInfo> = {}
): BuildDetailsVcsInfo {
  return {
    head_sha: 'abc123',
    base_sha: 'def456',
    pr_number: 42,
    head_ref: 'feature-branch',
    base_ref: 'main',
    head_repo_name: 'test/repo',
    base_repo_name: 'test/repo',
    provider: 'github',
    ...params,
  };
}

export function PreprodBuildDetailsFixture(
  params: Partial<BuildDetailsApiResponse> = {}
): BuildDetailsApiResponse {
  return {
    id: 'artifact-1',
    state: BuildDetailsState.PROCESSED,
    app_info: PreprodAppInfoFixture(),
    vcs_info: PreprodVcsInfoFixture(),
    size_info: undefined,
    ...params,
  };
}

export function PreprodBuildDetailsWithSizeInfoFixture(
  sizeState: BuildDetailsSizeAnalysisState,
  sizeData: Record<string, any> = {},
  params: Partial<BuildDetailsApiResponse> = {}
): BuildDetailsApiResponse {
  return {
    ...PreprodBuildDetailsFixture(params),
    size_info: {
      state: sizeState,
      ...sizeData,
    },
  };
}
