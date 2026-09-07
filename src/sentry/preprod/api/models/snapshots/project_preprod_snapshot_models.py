from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel


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
    canvas_theme: Literal["light", "dark"] | None = None

    class Config:
        extra = "allow"


class SnapshotImageDetailImageInfo(SnapshotImageResponse):
    diff_threshold: float | None = None
    description: str | None = None
    tags: dict[str, str] | None = None
    image_url: str


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


# TODO: POST request in the future when we migrate away from current schemas
