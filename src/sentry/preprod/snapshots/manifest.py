from __future__ import annotations

from pydantic import BaseModel, Field


class BaseImageMetadata(BaseModel):
    file_name: str | None = Field(None, alias="fileName")
    width: int = Field(ge=0)
    height: int = Field(ge=0)


class BYOImageMetadata(BaseImageMetadata):
    dark_mode: bool | None = Field(None, alias="darkMode")


class AndroidImageMetadata(BaseImageMetadata):
    device: str | None = None


class SnapshotManifest(BaseModel):

    images: dict[str, BYOImageMetadata | AndroidImageMetadata]
