from __future__ import annotations

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
