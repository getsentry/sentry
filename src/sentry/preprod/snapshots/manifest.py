from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    content_hash: str
    display_name: str | None = None
    group: str | None = None
    width: int = Field(ge=0)
    height: int = Field(ge=0)
    diff_threshold: float | None = Field(default=None, ge=0.0, lt=1.0)

    class Config:
        extra = "allow"


class SnapshotManifest(BaseModel):
    images: dict[str, ImageMetadata]
    diff_threshold: float | None = Field(default=None, ge=0.0, lt=1.0)
    selective: bool = False
    all_image_file_names: list[str] | None = None


class ComparisonImageResult(BaseModel):
    status: Literal["added", "removed", "changed", "unchanged", "errored", "renamed", "skipped"]
    head_hash: str | None = None
    base_hash: str | None = None
    changed_pixels: int | None = None
    total_pixels: int | None = None
    diff_mask_key: str | None = None
    diff_mask_image_id: str | None = None
    before_width: int | None = None
    before_height: int | None = None
    after_width: int | None = None
    after_height: int | None = None
    aligned_height: int | None = None
    reason: str | None = None
    previous_image_file_name: str | None = None


class ComparisonSummary(BaseModel):
    total: int
    changed: int
    unchanged: int
    added: int
    removed: int
    errored: int
    renamed: int
    skipped: int = 0


class ComparisonManifest(BaseModel):
    head_artifact_id: int
    base_artifact_id: int
    summary: ComparisonSummary
    images: dict[str, ComparisonImageResult]
