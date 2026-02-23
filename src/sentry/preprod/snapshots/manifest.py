from __future__ import annotations

from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    display_name: str
    image_file_name: str
    group: str | None = None
    width: int = Field(ge=0)
    height: int = Field(ge=0)

    class Config:
        extra = "allow"


class SnapshotManifest(BaseModel):
    images: dict[str, ImageMetadata]
