from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsVcsInfo
from sentry.preprod.models import PreprodArtifact


class SnapshotDiffSection(StrEnum):
    ADDED = "added"
    REMOVED = "removed"
    RENAMED = "renamed"
    CHANGED = "changed"
    UNCHANGED = "unchanged"
    ERRORED = "errored"


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


class SnapshotComparisonRunInfo(BaseModel):
    state: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None


class SnapshotApprover(BaseModel):
    id: str | None = None
    name: str | None = None
    email: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    approved_at: str | None = None
    source: Literal["sentry", "github"] = "sentry"


class SnapshotApprovalInfo(BaseModel):
    status: Literal["approved", "requires_approval"]
    approvers: list[SnapshotApprover] = []


class SnapshotDetailsApiResponse(BaseModel):
    head_artifact_id: str
    base_artifact_id: str | None = None
    project_id: str
    comparison_type: str
    state: PreprodArtifact.ArtifactState
    vcs_info: BuildDetailsVcsInfo

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

    comparison_run_info: SnapshotComparisonRunInfo | None = None

    approval_info: SnapshotApprovalInfo | None = None


# TODO: POST request in the future when we migrate away from current schemas
