from __future__ import annotations

from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    file_name: str | None = None
    width: int = Field(ge=0)
    height: int = Field(ge=0)

    class Config:
        extra = "allow"


class SnapshotManifest(BaseModel):
    images: dict[str, ImageMetadata]
