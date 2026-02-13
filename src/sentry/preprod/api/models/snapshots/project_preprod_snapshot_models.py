from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsVcsInfo
from sentry.preprod.models import PreprodArtifact


class SnapshotComparisonType(StrEnum):
    SOLO = "solo"
    DIFF = "diff"


class SnapshotDiffSection(StrEnum):
    ADDED = "added"
    REMOVED = "removed"
    CHANGED = "changed"
    UNCHANGED = "unchanged"


# GET request


class SnapshotGetRequest(BaseModel):
    offset: int = 0
    limit: int = 20
    section: SnapshotDiffSection | None = None


# GET response


class SnapshotImageResponse(BaseModel):
    id: str
    display_name: str = ""
    file_name: str | None = None
    width: int
    height: int


class SnapshotDiffPair(BaseModel):
    base_image: SnapshotImageResponse
    head_image: SnapshotImageResponse
    diff_image_key: str | None = None
    diff: float | None = None


class SnapshotDetailsApiResponse(BaseModel):
    head_artifact_id: str
    base_artifact_id: str | None = None  # Only present for diffs
    state: PreprodArtifact.ArtifactState
    comparison_type: SnapshotComparisonType
    vcs_info: BuildDetailsVcsInfo

    # Solo fields (comparison_type == SOLO)
    images: list[SnapshotImageResponse] = []
    image_count: int = 0

    # Diff fields (comparison_type == DIFF)
    added: list[SnapshotImageResponse] = []
    added_count: int = 0

    removed: list[SnapshotImageResponse] = []
    removed_count: int = 0

    changed: list[SnapshotDiffPair] = []
    changed_count: int = 0

    unchanged: list[SnapshotImageResponse] = []
    unchanged_count: int = 0


# TODO: POST request in the future when we migrate away from current schemas
