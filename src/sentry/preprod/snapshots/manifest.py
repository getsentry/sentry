from __future__ import annotations

from collections.abc import Set
from typing import Any, Literal

from pydantic import BaseModel, Field, validator


class ImageMetadata(BaseModel):
    content_hash: str
    display_name: str | None = None
    group: str | None = None
    width: int = Field(ge=0)
    height: int = Field(ge=0)
    diff_threshold: float | None = Field(default=None, ge=0.0, lt=1.0)
    description: str | None = None
    tags: dict[str, str] | None = None

    @validator("tags", pre=True)
    def coerce_tags(cls, v: object) -> dict[str, str] | None:
        if v is None:
            return None
        if isinstance(v, dict):
            return {str(k): str(v_) for k, v_ in v.items()}
        if isinstance(v, list):
            return {str(tag): str(tag) for tag in v}
        return None

    class Config:
        extra = "allow"

        @staticmethod
        def schema_extra(schema: dict[str, Any], model: type) -> None:
            tags = schema.get("properties", {}).get("tags")
            if tags:
                schema["properties"]["tags"] = {
                    "anyOf": [
                        {"type": "object"},
                        {"type": "array", "items": {"type": "string"}},
                        {"type": "null"},
                    ]
                }


_SCHEMA_FIELDS = frozenset(ImageMetadata.__fields__)


def image_metadata_extras(
    metadata: ImageMetadata, exclude: Set[str] | None = None
) -> dict[str, Any]:
    skip = _SCHEMA_FIELDS | exclude if exclude else _SCHEMA_FIELDS
    return {k: v for k, v in metadata.dict().items() if k not in skip}


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


class ChunkCandidate(BaseModel):
    name: str
    head_hash: str
    base_hash: str
    pixel_count: int
    diff_threshold: float


class ChunkAssignment(BaseModel):
    chunk_index: int
    candidates: list[ChunkCandidate]


class ComparisonPlan(BaseModel):
    head_artifact_id: int
    base_artifact_id: int
    chunks: list[ChunkAssignment]
    # Results that need no odiff (added/removed/skipped/renamed/unchanged/exceeds-pixel-limit).
    non_diff_images: dict[str, ComparisonImageResult]


class ChunkResult(BaseModel):
    chunk_index: int
    images: dict[str, ComparisonImageResult]
