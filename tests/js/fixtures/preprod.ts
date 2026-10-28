import type {
  BuildDetailsApiResponse,
  BuildDetailsAppInfo,
  BuildDetailsSizeInfo,
  BuildDetailsVcsInfo,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {
  SnapshotApprover,
  SnapshotDetailsApiResponse,
} from 'sentry/views/preprod/types/snapshotTypes';

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
      install_groups: null,
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

export function SnapshotApproverFixture(
  params: Partial<SnapshotApprover> = {}
): SnapshotApprover {
  return {
    source: 'sentry',
    id: '1',
    name: 'Alice Chen',
    email: 'alice@example.com',
    username: 'alice',
    avatar_url: null,
    approved_at: null,
    ...params,
  };
}

export function SnapshotDetailsFixture(
  params: Partial<SnapshotDetailsApiResponse> = {}
): SnapshotDetailsApiResponse {
  return {
    head_artifact_id: '123',
    base_artifact_id: null,
    project_id: '456',
    app_id: 'sentry-frontend',
    state: 'processed',
    comparison_type: 'diff',
    comparison_state: 'success',
    approval_status: 'requires_approval',
    approvers: [],
    comparison_error_message: null,
    diff_threshold: null,
    image_count: 0,
    images: [],
    vcs_info: PreprodVcsInfoFullFixture(),
    added: [],
    added_count: 0,
    changed: [],
    changed_count: 0,
    removed: [],
    removed_count: 0,
    unchanged: [],
    unchanged_count: 0,
    ...params,
  };
}
