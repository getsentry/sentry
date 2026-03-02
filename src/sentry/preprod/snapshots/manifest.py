from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    display_name: str | None = None
    image_file_name: str
    width: int = Field(ge=0)
    height: int = Field(ge=0)

    class Config:
        extra = "allow"


class SnapshotManifest(BaseModel):
    images: dict[str, ImageMetadata]


class ComparisonImageResult(BaseModel):
    status: Literal["added", "removed", "changed", "unchanged", "errored"]
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


class ComparisonSummary(BaseModel):
    total: int
    changed: int
    unchanged: int
    added: int
    removed: int
    errored: int


class ComparisonManifest(BaseModel):
    head_artifact_id: int
    base_artifact_id: int
    summary: ComparisonSummary
    images: dict[str, ComparisonImageResult]
