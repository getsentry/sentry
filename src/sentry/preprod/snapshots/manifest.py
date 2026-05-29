from __future__ import annotations

from collections.abc import Callable, Sequence, Set
from typing import Any, Literal

import re2
from pydantic import BaseModel, Field, root_validator, validator

# Invalid patterns are client input we surface as a 400, not a server error worth logging.
_RE2_OPTIONS = re2.Options()
_RE2_OPTIONS.log_errors = False


class InvalidImageNamePattern(ValueError):
    def __init__(self, pattern: str) -> None:
        super().__init__(pattern)
        self.pattern = pattern


def make_image_name_matcher(patterns: Sequence[str]) -> Callable[[str], bool]:
    """
    Build a predicate testing whether a name fully matches any of `patterns`.

    Patterns compile with RE2, a linear-time engine: matching cannot catastrophically
    backtrack, so no time budget is needed. RE2 rejects unsupported constructs
    (backreferences, lookaround) at compile time; we raise InvalidImageNamePattern
    carrying the offending pattern.
    """
    compiled: list[Any] = []
    for pattern in patterns:
        try:
            compiled.append(re2.compile(pattern, _RE2_OPTIONS))
        except re2.error as e:
            raise InvalidImageNamePattern(pattern) from e
    return lambda name: any(compiled_pattern.fullmatch(name) for compiled_pattern in compiled)


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
    all_image_file_names_as_regex: list[str] | None = None

    @root_validator(skip_on_failure=True)
    def _all_image_file_names_mutually_exclusive(cls, values: dict[str, Any]) -> dict[str, Any]:
        if (
            values.get("all_image_file_names") is not None
            and values.get("all_image_file_names_as_regex") is not None
        ):
            raise ValueError(
                "all_image_file_names and all_image_file_names_as_regex are mutually exclusive"
            )
        return values

    def head_image_name_matcher(self) -> Callable[[str], bool] | None:
        """
        Return a check for whether a name is in the head's declared image set, or
        None if the head didn't declare one. Distinguishes removed images (not in the
        set) from skipped ones (in the set but not re-uploaded).
        """
        if self.all_image_file_names is not None:
            return set(self.all_image_file_names).__contains__
        if self.all_image_file_names_as_regex is not None:
            return make_image_name_matcher(self.all_image_file_names_as_regex)
        return None


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
