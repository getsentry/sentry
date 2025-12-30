import type {
  BuildDetailsApiResponse,
  BuildDetailsAppInfo,
  BuildDetailsSizeInfo,
  BuildDetailsVcsInfo,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

function PreprodAppInfoFixture(
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

function PreprodVcsInfoFixture(
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

function PreprodBuildDetailsFixture(
  params: Partial<BuildDetailsApiResponse> = {}
): BuildDetailsApiResponse {
  return {
    id: 'artifact-1',
    project_id: 1,
    project_slug: 'test-project',
    state: BuildDetailsState.PROCESSED,
    app_info: PreprodAppInfoFixture(),
    distribution_info: {
      is_installable: false,
      download_count: 0,
      release_notes: null,
    },
    vcs_info: PreprodVcsInfoFixture(),
    size_info: undefined,
    ...params,
  };
}

export function PreprodBuildDetailsWithSizeInfoFixture(
  sizeInfo: BuildDetailsSizeInfo,
  params: Partial<BuildDetailsApiResponse> = {}
): BuildDetailsApiResponse {
  return {
    ...PreprodBuildDetailsFixture(params),
    size_info: sizeInfo,
  };
}
