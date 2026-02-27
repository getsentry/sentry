from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DiffResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    diff_mask_png: str
    changed_pixels: int
    total_pixels: int
    aligned_height: int
    before_width: int
    before_height: int
    after_width: int
    after_height: int


class OdiffResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    requestId: int
    match: bool = False
    reason: str | None = None
    diffCount: int | None = None
    diffPercentage: float | None = None
    error: str | None = None
