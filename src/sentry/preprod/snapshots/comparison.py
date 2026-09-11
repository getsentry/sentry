from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Literal, NamedTuple

from objectstore_client import Session

from sentry.preprod.snapshots.categorize import categorize_image_diff
from sentry.preprod.snapshots.execution import ImageDiffFailure, ImagePair, measure_image_pairs
from sentry.preprod.snapshots.image_diff.compare import MAX_DIFF_PIXELS, get_comparison_size
from sentry.preprod.snapshots.image_diff.types import DiffResult, ImageSize
from sentry.preprod.snapshots.manifest import (
    ChunkAssignment,
    ChunkCandidate,
    ChunkResult,
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonPlan,
    ComparisonSummary,
    ImageMetadata,
    SnapshotManifest,
)
from sentry.preprod.snapshots.storage import _diff_mask_key, _put_diff_mask
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class SnapshotChanges(NamedTuple):
    images: dict[str, ComparisonImageResult]
    candidates: list[ChunkCandidate]


def _create_pixel_batches(
    items: list[ChunkCandidate],
    max_pixels_per_batch: int,
    max_pairs_per_batch: int | None = None,
) -> list[list[ChunkCandidate]]:
    batches: list[list[ChunkCandidate]] = []
    current_batch: list[ChunkCandidate] = []
    current_pixels = 0
    for item in items:
        pixels = item.pixel_count
        if current_batch and (
            current_pixels + pixels > max_pixels_per_batch
            or (max_pairs_per_batch is not None and len(current_batch) >= max_pairs_per_batch)
        ):
            batches.append(current_batch)
            current_batch = [item]
            current_pixels = pixels
        else:
            current_batch.append(item)
            current_pixels += pixels
    if current_batch:
        batches.append(current_batch)
    return batches


def _effective_diff_threshold(manifest: SnapshotManifest, name: str) -> float:
    image = manifest.images.get(name)
    if image is not None and image.diff_threshold is not None:
        return image.diff_threshold
    if manifest.diff_threshold is not None:
        return manifest.diff_threshold
    return 0.0


def plan_snapshot_changes(
    head_manifest: SnapshotManifest, base_manifest: SnapshotManifest
) -> SnapshotChanges:
    categories = categorize_image_diff(head_manifest, base_manifest)
    images: dict[str, ComparisonImageResult] = {}
    candidates: list[ChunkCandidate] = []

    for name in sorted(categories.matched):
        head_hash = categories.head_by_name[name]
        base_hash = categories.base_by_name[name]
        if head_hash == base_hash:
            images[name] = ComparisonImageResult(
                status="unchanged", head_hash=head_hash, base_hash=base_hash
            )
            continue
        candidate = make_diff_candidate(head_manifest, name, base_manifest.images[name])
        if candidate is None:
            images[name] = ComparisonImageResult(
                status="errored",
                head_hash=head_hash,
                base_hash=base_hash,
                reason="exceeds_pixel_limit",
            )
        else:
            candidates.append(candidate)

    for name in sorted(categories.added):
        images[name] = ComparisonImageResult(
            status="added", head_hash=categories.head_by_name[name]
        )
    for status, names in (("removed", categories.removed), ("skipped", categories.skipped)):
        for name in sorted(names):
            metadata = base_manifest.images[name]
            images[name] = ComparisonImageResult(
                status=status,
                base_hash=metadata.content_hash,
                before_width=metadata.width,
                before_height=metadata.height,
            )
    for new_name, old_name in sorted(categories.renamed_pairs):
        images[new_name] = ComparisonImageResult(
            status="renamed",
            head_hash=categories.head_by_name[new_name],
            previous_image_file_name=old_name,
        )
    return SnapshotChanges(images, candidates)


def make_diff_candidate(
    head_manifest: SnapshotManifest,
    name: str,
    reference: ImageMetadata,
    kind: Literal["base", "sibling"] = "base",
) -> ChunkCandidate | None:
    head = head_manifest.images[name]
    pixel_count = get_comparison_size(
        ImageSize(head.width, head.height), ImageSize(reference.width, reference.height)
    ).pixel_count
    if pixel_count > MAX_DIFF_PIXELS:
        return None
    return ChunkCandidate(
        name=name,
        head_hash=head.content_hash,
        base_hash=reference.content_hash,
        pixel_count=pixel_count,
        diff_threshold=_effective_diff_threshold(head_manifest, name),
        kind=kind,
    )


def _errored_result(candidate: ChunkCandidate, reason: str) -> ComparisonImageResult:
    return ComparisonImageResult(
        status="errored",
        head_hash=candidate.head_hash,
        base_hash=candidate.base_hash,
        reason=reason,
    )


def _image_name_to_path_stem(name: str) -> str:
    normalized = name.replace("\\", "/").strip("/")
    return normalized.rsplit(".", 1)[0] if "." in normalized else normalized


def _diff_ratio(result: DiffResult) -> float:
    return result.changed_pixels / result.total_pixels if result.total_pixels > 0 else 0.0


def _process_chunk(
    session: Session,
    assignment: ChunkAssignment,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    *,
    mask_prefix: str | None = None,
) -> ChunkResult:
    pairs = [
        ImagePair(candidate.base_hash, candidate.head_hash, include_mask=candidate.kind == "base")
        for candidate in assignment.candidates
    ]
    measurements = measure_image_pairs(session, pairs, org_id, project_id)
    result = ChunkResult(chunk_index=assignment.chunk_index, images={})
    for request_index, (candidate, measurement) in enumerate(
        zip(assignment.candidates, measurements, strict=True)
    ):
        if isinstance(measurement, ImageDiffFailure):
            image = _errored_result(candidate, measurement.reason)
        else:
            image = ComparisonImageResult(
                status="changed"
                if _diff_ratio(measurement) > candidate.diff_threshold
                else "unchanged",
                head_hash=candidate.head_hash,
                base_hash=candidate.base_hash,
                changed_pixels=measurement.changed_pixels,
                total_pixels=measurement.total_pixels,
            )
            if candidate.kind == "base":
                stem = _image_name_to_path_stem(candidate.name)
                image.diff_mask_key = (
                    f"{mask_prefix}/{request_index}.png"
                    if mask_prefix
                    else _diff_mask_key(
                        org_id, project_id, head_artifact_id, base_artifact_id, stem
                    )
                )
                _put_diff_mask(session, image.diff_mask_key, measurement.diff_mask_png)
                image.diff_mask_image_id = image.diff_mask_key.removeprefix(
                    f"{org_id}/{project_id}/"
                )
                image.before_width = measurement.before_width
                image.before_height = measurement.before_height
                image.after_width = measurement.after_width
                image.after_height = measurement.after_height
                image.aligned_height = measurement.aligned_height
                if image.status == "unchanged":
                    metrics.incr("preprod.snapshots.odiff.unchanged_with_diff_hash")
                    logger.info(
                        "preprod.snapshots.odiff.unchanged_with_diff_hash",
                        extra={
                            "image_name": candidate.name,
                            "org_id": org_id,
                            "head_artifact_id": head_artifact_id,
                            "base_artifact_id": base_artifact_id,
                            "head_hash": candidate.head_hash,
                            "base_hash": candidate.base_hash,
                            "changed_pixels": measurement.changed_pixels,
                            "threshold": candidate.diff_threshold,
                        },
                    )
        target = result.sibling_images if candidate.kind == "sibling" else result.images
        target[candidate.name] = image
    return result


def _failed_chunk(assignment: ChunkAssignment, reason: str) -> ChunkResult:
    result = ChunkResult(chunk_index=assignment.chunk_index, images={})
    for candidate in assignment.candidates:
        target = result.sibling_images if candidate.kind == "sibling" else result.images
        target[candidate.name] = _errored_result(candidate, reason)
    return result


def _validate_chunk(assignment: ChunkAssignment, result: ChunkResult) -> None:
    expected_base = {
        candidate.name for candidate in assignment.candidates if candidate.kind == "base"
    }
    expected_sibling = {
        candidate.name for candidate in assignment.candidates if candidate.kind == "sibling"
    }
    if expected_base != result.images.keys() or expected_sibling != result.sibling_images.keys():
        raise ValueError("Chunk results do not cover their assignment")
    for candidate in assignment.candidates:
        images = result.sibling_images if candidate.kind == "sibling" else result.images
        image = images[candidate.name]
        if (image.head_hash, image.base_hash) != (candidate.head_hash, candidate.base_hash):
            raise ValueError("Chunk result hashes do not match their assignment")
        if image.status not in ("changed", "unchanged", "errored"):
            raise ValueError("Unexpected image comparison result status")
        if image.status != "errored" and (
            image.total_pixels is None
            or image.changed_pixels is None
            or image.total_pixels <= 0
            or not 0 <= image.changed_pixels <= image.total_pixels
        ):
            raise ValueError("Invalid pixel measurements in chunk result")


def _assemble_comparison(
    plan: ComparisonPlan,
    results: Iterable[ChunkResult],
) -> tuple[ComparisonManifest, dict[str, ComparisonImageResult]]:
    images = dict(plan.non_diff_images)
    sibling_images: dict[str, ComparisonImageResult] = {}
    for result in results:
        images.update(result.images)
        sibling_images.update(result.sibling_images)
    counts = {
        status: 0
        for status in ("changed", "unchanged", "added", "removed", "errored", "renamed", "skipped")
    }
    for image in images.values():
        counts[image.status] += 1
    return ComparisonManifest(
        head_artifact_id=plan.head_artifact_id,
        base_artifact_id=plan.base_artifact_id,
        summary=ComparisonSummary(total=len(images), **counts),
        images=images,
    ), sibling_images
