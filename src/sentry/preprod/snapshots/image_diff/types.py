from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DiffResult:
    diff_mask_png: str
    diff_score: float
    changed_pixels: int
    total_pixels: int
    aligned_height: int
    width: int
    before_width: int
    before_height: int
    after_width: int
    after_height: int
