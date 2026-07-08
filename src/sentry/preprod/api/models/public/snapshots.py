from __future__ import annotations

from typing import Literal, TypedDict


class VcsInfoResponseDict(TypedDict, total=False):
    head_sha: str | None
    base_sha: str | None
    provider: str | None
    head_repo_name: str | None
    base_repo_name: str | None
    head_ref: str | None
    base_ref: str | None
    pr_number: int | None


class SnapshotImageResponseDict(TypedDict, total=False):
    key: str
    display_name: str | None
    group: str | None
    image_file_name: str
    width: int
    height: int
    canvas_theme: Literal["light", "dark"] | None


class SnapshotDiffPairResponseDict(TypedDict, total=False):
    base_image: SnapshotImageResponseDict
    head_image: SnapshotImageResponseDict
    diff_image_key: str | None
    diff: float | None


class SnapshotApproverResponseDict(TypedDict, total=False):
    id: str | None
    name: str | None
    email: str | None
    username: str | None
    avatar_url: str | None
    approved_at: str | None
    source: Literal["sentry", "github"]


class SnapshotDetailsResponseDict(TypedDict, total=False):
    head_artifact_id: str
    base_artifact_id: str | None
    project_id: str
    comparison_type: str
    state: str
    vcs_info: VcsInfoResponseDict
    app_id: str | None
    is_selective: bool
    images: list[SnapshotImageResponseDict]
    image_count: int
    added: list[SnapshotImageResponseDict]
    added_count: int
    removed: list[SnapshotImageResponseDict]
    removed_count: int
    renamed: list[SnapshotDiffPairResponseDict]
    renamed_count: int
    changed: list[SnapshotDiffPairResponseDict]
    changed_count: int
    unchanged: list[SnapshotImageResponseDict]
    unchanged_count: int
    errored: list[SnapshotDiffPairResponseDict]
    errored_count: int
    skipped: list[SnapshotImageResponseDict]
    skipped_count: int
    diff_threshold: float | None
    comparison_state: str | None
    approval_status: str | None
    comparison_error_message: str | None
    approvers: list[SnapshotApproverResponseDict]


class SnapshotCreateResponseDict(TypedDict):
    artifactId: str
    snapshotMetricsId: str
    imageCount: int
    snapshotUrl: str


class SnapshotImageDetailImageInfoResponseDict(SnapshotImageResponseDict, total=False):
    diff_threshold: float | None
    description: str | None
    tags: dict[str, str] | None
    image_url: str


class SnapshotImageDetailResponseDict(TypedDict, total=False):
    image_file_name: str
    comparison_status: str | None
    head_image: SnapshotImageDetailImageInfoResponseDict | None
    base_image: SnapshotImageDetailImageInfoResponseDict | None
    diff_image_url: str | None
    diff_percentage: float | None
    previous_image_file_name: str | None


class LatestBaseSnapshotImageResponseDict(SnapshotImageResponseDict, total=False):
    image_url: str


class LatestBaseSnapshotVcsInfoResponseDict(TypedDict, total=False):
    head_sha: str | None
    base_sha: str | None
    head_ref: str | None
    base_ref: str | None
    head_repo_name: str | None
    pr_number: int | None


class LatestBaseSnapshotResponseDict(TypedDict, total=False):
    head_artifact_id: str
    project_id: str
    project_slug: str
    app_id: str | None
    image_count: int
    images: list[LatestBaseSnapshotImageResponseDict]
    diff_threshold: float | None
    date_added: str
    vcs_info: LatestBaseSnapshotVcsInfoResponseDict
