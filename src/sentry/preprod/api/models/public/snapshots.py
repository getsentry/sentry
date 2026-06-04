from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


class VcsInfoResponseDict(TypedDict):
    head_sha: NotRequired[str | None]
    base_sha: NotRequired[str | None]
    provider: NotRequired[str | None]
    head_repo_name: NotRequired[str | None]
    base_repo_name: NotRequired[str | None]
    head_ref: NotRequired[str | None]
    base_ref: NotRequired[str | None]
    pr_number: NotRequired[int | None]


class SnapshotImageResponseDict(TypedDict):
    key: NotRequired[str]
    display_name: NotRequired[str | None]
    group: NotRequired[str | None]
    image_file_name: NotRequired[str]
    width: NotRequired[int]
    height: NotRequired[int]


class SnapshotDiffPairResponseDict(TypedDict):
    base_image: NotRequired[SnapshotImageResponseDict]
    head_image: NotRequired[SnapshotImageResponseDict]
    diff_image_key: NotRequired[str | None]
    diff: NotRequired[float | None]


class SnapshotApproverResponseDict(TypedDict):
    id: NotRequired[str | None]
    name: NotRequired[str | None]
    email: NotRequired[str | None]
    username: NotRequired[str | None]
    avatar_url: NotRequired[str | None]
    approved_at: NotRequired[str | None]
    source: NotRequired[Literal["sentry", "github"]]


class SnapshotDetailsResponseDict(TypedDict):
    head_artifact_id: NotRequired[str]
    base_artifact_id: NotRequired[str | None]
    project_id: NotRequired[str]
    comparison_type: NotRequired[str]
    state: NotRequired[str]
    vcs_info: NotRequired[VcsInfoResponseDict]
    app_id: NotRequired[str | None]
    is_selective: NotRequired[bool]
    images: NotRequired[list[SnapshotImageResponseDict]]
    image_count: NotRequired[int]
    added: NotRequired[list[SnapshotImageResponseDict]]
    added_count: NotRequired[int]
    removed: NotRequired[list[SnapshotImageResponseDict]]
    removed_count: NotRequired[int]
    renamed: NotRequired[list[SnapshotDiffPairResponseDict]]
    renamed_count: NotRequired[int]
    changed: NotRequired[list[SnapshotDiffPairResponseDict]]
    changed_count: NotRequired[int]
    unchanged: NotRequired[list[SnapshotImageResponseDict]]
    unchanged_count: NotRequired[int]
    errored: NotRequired[list[SnapshotDiffPairResponseDict]]
    errored_count: NotRequired[int]
    skipped: NotRequired[list[SnapshotImageResponseDict]]
    skipped_count: NotRequired[int]
    diff_threshold: NotRequired[float | None]
    comparison_state: NotRequired[str | None]
    approval_status: NotRequired[str | None]
    comparison_error_message: NotRequired[str | None]
    approvers: NotRequired[list[SnapshotApproverResponseDict]]


class SnapshotCreateResponseDict(TypedDict):
    artifactId: str
    snapshotMetricsId: str
    imageCount: int
    snapshotUrl: str


class SnapshotImageDetailImageInfoResponseDict(TypedDict):
    content_hash: NotRequired[str]
    display_name: NotRequired[str | None]
    group: NotRequired[str | None]
    image_file_name: NotRequired[str]
    width: NotRequired[int]
    height: NotRequired[int]
    diff_threshold: NotRequired[float | None]
    description: NotRequired[str | None]
    tags: NotRequired[dict[str, str] | None]
    image_url: NotRequired[str]


class SnapshotImageDetailResponseDict(TypedDict):
    image_file_name: NotRequired[str]
    comparison_status: NotRequired[str | None]
    head_image: NotRequired[SnapshotImageDetailImageInfoResponseDict | None]
    base_image: NotRequired[SnapshotImageDetailImageInfoResponseDict | None]
    diff_image_url: NotRequired[str | None]
    diff_percentage: NotRequired[float | None]
    previous_image_file_name: NotRequired[str | None]


class LatestBaseSnapshotImageResponseDict(TypedDict):
    key: NotRequired[str]
    display_name: NotRequired[str | None]
    group: NotRequired[str | None]
    image_file_name: NotRequired[str]
    width: NotRequired[int]
    height: NotRequired[int]
    image_url: NotRequired[str]


class LatestBaseSnapshotVcsInfoResponseDict(TypedDict):
    head_sha: NotRequired[str | None]
    base_sha: NotRequired[str | None]
    head_ref: NotRequired[str | None]
    base_ref: NotRequired[str | None]
    head_repo_name: NotRequired[str | None]
    pr_number: NotRequired[int | None]


class LatestBaseSnapshotResponseDict(TypedDict):
    head_artifact_id: NotRequired[str]
    project_id: NotRequired[str]
    project_slug: NotRequired[str]
    app_id: NotRequired[str | None]
    image_count: NotRequired[int]
    images: NotRequired[list[LatestBaseSnapshotImageResponseDict]]
    diff_threshold: NotRequired[float | None]
    date_added: NotRequired[str]
    vcs_info: NotRequired[LatestBaseSnapshotVcsInfoResponseDict]
