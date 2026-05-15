from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsVcsInfo
from sentry.preprod.api.models.snapshots.snapshot_status import (
    ApprovalStatusLiteral,
    ComparisonStateLiteral,
)
from sentry.preprod.models import PreprodArtifact


class SnapshotDiffSection(StrEnum):
    ADDED = "added"
    REMOVED = "removed"
    RENAMED = "renamed"
    CHANGED = "changed"
    UNCHANGED = "unchanged"
    ERRORED = "errored"
    SKIPPED = "skipped"


# GET response


class SnapshotImageResponse(BaseModel):
    key: str
    display_name: str | None = None
    group: str | None = None
    image_file_name: str
    width: int
    height: int

    class Config:
        extra = "allow"


class SnapshotDiffPair(BaseModel):
    base_image: SnapshotImageResponse
    head_image: SnapshotImageResponse
    diff_image_key: str | None = None
    diff: float | None = None


class SnapshotImageDetailImageInfo(BaseModel):
    content_hash: str
    display_name: str | None = None
    group: str | None = None
    image_file_name: str
    width: int
    height: int
    diff_threshold: float | None = None
    description: str | None = None
    tags: dict[str, str] | None = None
    image_url: str

    class Config:
        extra = "allow"


class SnapshotImageDetailResponse(BaseModel):
    image_file_name: str
    comparison_status: (
        Literal["added", "removed", "changed", "unchanged", "renamed", "errored", "skipped"] | None
    ) = None
    head_image: SnapshotImageDetailImageInfo | None = None
    base_image: SnapshotImageDetailImageInfo | None = None
    diff_image_url: str | None = None
    diff_percentage: float | None = None
    previous_image_file_name: str | None = None


class SnapshotApprover(BaseModel):
    id: str | None = None
    name: str | None = None
    email: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    approved_at: str | None = None
    source: Literal["sentry", "github"] = "sentry"


class SnapshotDetailsApiResponse(BaseModel):
    head_artifact_id: str
    base_artifact_id: str | None = None
    project_id: str
    comparison_type: str
    state: PreprodArtifact.ArtifactState
    vcs_info: BuildDetailsVcsInfo
    app_id: str | None = None

    # Solo fields (comparison_type == SOLO)
    images: list[SnapshotImageResponse] = []
    image_count: int = 0

    # Diff fields (comparison_type == DIFF)
    added: list[SnapshotImageResponse] = []
    added_count: int = 0

    removed: list[SnapshotImageResponse] = []
    removed_count: int = 0

    renamed: list[SnapshotDiffPair] = []
    renamed_count: int = 0

    changed: list[SnapshotDiffPair] = []
    changed_count: int = 0

    unchanged: list[SnapshotImageResponse] = []
    unchanged_count: int = 0

    errored: list[SnapshotDiffPair] = []
    errored_count: int = 0

    skipped: list[SnapshotImageResponse] = []
    skipped_count: int = 0

    diff_threshold: float | None = None

    comparison_state: ComparisonStateLiteral | None = None
    approval_status: ApprovalStatusLiteral | None = None
    comparison_error_message: str | None = None
    approvers: list[SnapshotApprover] = []


# TODO: POST request in the future when we migrate away from current schemas
