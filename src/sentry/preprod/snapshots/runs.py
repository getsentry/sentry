from __future__ import annotations

from typing import Literal

from django.db import models
from pydantic import Field

from sentry.preprod.snapshots.image_diff.compare import DIFF_ALGORITHM_VERSION
from sentry.preprod.snapshots.manifest import ChunkAssignment, ChunkResult, ComparisonPlan
from sentry.preprod.snapshots.models import PreprodSnapshotComparison


class FrozenChunkAssignment(ChunkAssignment):
    schema_version: Literal[2] = 2
    execution_id: str = Field(regex=r"^[0-9a-f]{32}$")
    diff_algorithm_version: int


class FrozenChunkResult(ChunkResult):
    schema_version: Literal[2] = 2
    execution_id: str = Field(regex=r"^[0-9a-f]{32}$")
    diff_algorithm_version: int


class FrozenComparisonPlan(ComparisonPlan):
    schema_version: Literal[2] = 2
    execution_id: str = Field(regex=r"^[0-9a-f]{32}$")
    diff_algorithm_version: int
    sibling_fingerprints: list[tuple[str, str, str | None, str | None]]


def run_queryset(
    comparison_id: int, execution_id: str | None
) -> models.QuerySet[PreprodSnapshotComparison]:
    queryset = PreprodSnapshotComparison.objects.filter(id=comparison_id)
    if execution_id is None:
        return queryset.filter(extras__snapshot_execution_id__isnull=True)
    return queryset.filter(extras__snapshot_execution_id=execution_id)


def run_prefix(
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    execution_id: str,
) -> str:
    return f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}/runs/{execution_id}"


def validate_plan(
    plan: FrozenComparisonPlan,
    execution_id: str,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    if (
        plan.execution_id != execution_id
        or plan.head_artifact_id != head_artifact_id
        or plan.base_artifact_id != base_artifact_id
        or plan.diff_algorithm_version != DIFF_ALGORITHM_VERSION
    ):
        raise ValueError("Comparison plan does not match this execution")
    if [chunk.chunk_index for chunk in plan.chunks] != list(range(len(plan.chunks))):
        raise ValueError("Comparison plan chunk indices are not contiguous")
    candidate_keys = [
        (candidate.kind, candidate.name) for chunk in plan.chunks for candidate in chunk.candidates
    ]
    if len(candidate_keys) != len(set(candidate_keys)):
        raise ValueError("Comparison plan contains duplicate work")
    if any(kind == "base" and name in plan.non_diff_images for kind, name in candidate_keys):
        raise ValueError("Comparison plan contains conflicting image results")


def validate_chunk_result(
    result: FrozenChunkResult, assignment: ChunkAssignment, plan: FrozenComparisonPlan
) -> None:
    if (
        result.execution_id != plan.execution_id
        or result.diff_algorithm_version != plan.diff_algorithm_version
        or result.chunk_index != assignment.chunk_index
    ):
        raise ValueError("Chunk result does not match this execution")
    for kind, images in (("base", result.images), ("sibling", result.sibling_images)):
        candidates = {
            candidate.name: candidate
            for candidate in assignment.candidates
            if candidate.kind == kind
        }
        if images.keys() != candidates.keys():
            raise ValueError("Chunk result does not match its assigned images")
        for name, image in images.items():
            candidate = candidates[name]
            if (
                image.head_hash != candidate.head_hash
                or image.base_hash != candidate.base_hash
                or image.status not in ("changed", "unchanged", "errored")
            ):
                raise ValueError("Chunk result does not match its assigned hashes")
            if image.status == "errored":
                continue
            if (
                image.changed_pixels is None
                or image.total_pixels is None
                or not 0 <= image.changed_pixels <= image.total_pixels
                or image.total_pixels <= 0
            ):
                raise ValueError("Chunk result has invalid pixel measurements")
            is_changed = image.changed_pixels / image.total_pixels > candidate.diff_threshold
            if (image.status == "changed") != is_changed:
                raise ValueError("Chunk result does not match its assigned threshold")
