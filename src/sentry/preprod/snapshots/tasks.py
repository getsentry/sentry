from __future__ import annotations

import base64
import logging
from typing import NamedTuple

import orjson
from django.db import IntegrityError
from objectstore_client.client import RequestError
from pydantic import ValidationError

from sentry.objectstore import get_preprod_session
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.image_diff.compare import compare_images_batch
from sentry.preprod.snapshots.image_diff.odiff import OdiffServer
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)

MAX_DIFF_PIXELS = 40_000_000
MAX_PIXELS_PER_BATCH = 40_000_000


class _DiffCandidate(NamedTuple):
    name: str
    head_hash: str
    base_hash: str
    pixel_count: int


def _image_name_to_path_stem(name: str) -> str:
    normalized = name.replace("\\", "/").strip("/")
    return normalized.rsplit(".", 1)[0] if "." in normalized else normalized


def _create_pixel_batches(
    items: list[_DiffCandidate],
    max_pixels_per_batch: int,
) -> list[list[_DiffCandidate]]:
    batches: list[list[_DiffCandidate]] = []
    current_batch: list[_DiffCandidate] = []
    current_pixels = 0
    for item in items:
        pixels = item.pixel_count
        if current_pixels + pixels > max_pixels_per_batch and current_batch:
            batches.append(current_batch)
            current_batch = [item]
            current_pixels = pixels
        else:
            current_batch.append(item)
            current_pixels += pixels
    if current_batch:
        batches.append(current_batch)
    return batches


@instrumented_task(
    name="sentry.preprod.tasks.compare_snapshots",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.REGION,
    processing_deadline_duration=300,
)
def compare_snapshots(
    project_id: int,
    org_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    logger.info(
        "Snapshot comparison kicked off for artifacts",
        extra={
            "head_artifact_id": head_artifact_id,
            "base_artifact_id": base_artifact_id,
        },
    )

    try:
        head_artifact = PreprodArtifact.objects.get(
            id=head_artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
        )
        base_artifact = PreprodArtifact.objects.get(
            id=base_artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "Snapshot comparison artifact not found",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )
        return

    try:
        head_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=head_artifact)
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)
    except PreprodSnapshotMetrics.DoesNotExist:
        logger.exception(
            "Snapshot comparison metrics not found",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
            },
        )
        return

    comparison: PreprodSnapshotComparison | None = None
    try:
        comparison, created = PreprodSnapshotComparison.objects.get_or_create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            defaults={"state": PreprodSnapshotComparison.State.PROCESSING},
        )
    except IntegrityError:
        comparison = PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
        ).first()
        if comparison is None:
            logger.exception(
                "Snapshot comparison not found after IntegrityError",
                extra={
                    "head_artifact_id": head_artifact_id,
                    "base_artifact_id": base_artifact_id,
                },
            )
            return
        created = False

    if not created:
        logger.info(
            "compare_snapshots: existing comparison found (id=%d, state=%s)",
            comparison.id,
            comparison.state,
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )
        updated = PreprodSnapshotComparison.objects.filter(
            id=comparison.id,
            state__in=[
                PreprodSnapshotComparison.State.PENDING,
                PreprodSnapshotComparison.State.FAILED,
            ],
        ).update(state=PreprodSnapshotComparison.State.PROCESSING)
        if not updated:
            logger.info(
                "compare_snapshots: skipping, comparison not in retryable state (state=%s)",
                comparison.state,
                extra={"head_artifact_id": head_artifact_id, "comparison_id": comparison.id},
            )
            return
        comparison.state = PreprodSnapshotComparison.State.PROCESSING
    else:
        logger.info(
            "compare_snapshots: created new comparison (id=%d)",
            comparison.id,
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )

    try:
        session = get_preprod_session(org_id, project_id)

        head_manifest_key = (head_metrics.extras or {}).get("manifest_key")
        base_manifest_key = (base_metrics.extras or {}).get("manifest_key")

        logger.info(
            "compare_snapshots: loading manifests",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "head_manifest_key": head_manifest_key,
                "base_manifest_key": base_manifest_key,
            },
        )

        if not head_manifest_key or not base_manifest_key:
            raise ValueError("Missing manifest key")

        try:
            head_manifest = SnapshotManifest(
                **orjson.loads(session.get(head_manifest_key).payload.read())
            )
            base_manifest = SnapshotManifest(
                **orjson.loads(session.get(base_manifest_key).payload.read())
            )
        except (orjson.JSONDecodeError, RequestError, ValidationError, TypeError):
            logger.exception(
                "compare_snapshots: failed to load or parse manifest",
                extra={
                    "head_artifact_id": head_artifact_id,
                    "base_artifact_id": base_artifact_id,
                },
            )
            comparison.state = PreprodSnapshotComparison.State.FAILED
            comparison.error_code = PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR
            comparison.save(update_fields=["state", "error_code", "date_updated"])
            return

        head_images = head_manifest.images
        base_images = base_manifest.images

        head_by_name = {meta.image_file_name: h for h, meta in head_images.items()}
        base_by_name = {meta.image_file_name: h for h, meta in base_images.items()}

        matched = head_by_name.keys() & base_by_name.keys()
        added = head_by_name.keys() - base_by_name.keys()
        removed = base_by_name.keys() - head_by_name.keys()

        image_results: dict[str, dict[str, object]] = {}
        changed_count = 0
        unchanged_count = 0
        error_count = 0

        image_key_prefix = f"{org_id}/{project_id}"

        eligible: list[_DiffCandidate] = []

        for name in sorted(matched):
            head_hash = head_by_name[name]
            base_hash = base_by_name[name]

            if head_hash == base_hash:
                unchanged_count += 1
                image_results[name] = {
                    "status": "unchanged",
                    "head_hash": head_hash,
                    "base_hash": base_hash,
                }
                continue

            head_meta = head_images[head_hash]
            base_meta = base_images[base_hash]
            head_pixels = head_meta.width * head_meta.height
            base_pixels = base_meta.width * base_meta.height
            pixel_count = max(head_pixels, base_pixels)

            if pixel_count > MAX_DIFF_PIXELS:
                error_count += 1
                logger.warning(
                    "Skipping oversized image in snapshot comparison",
                    extra={
                        "name": name,
                        "pixel_count": pixel_count,
                        "max_diff_pixels": MAX_DIFF_PIXELS,
                        "head_artifact_id": head_artifact_id,
                        "base_artifact_id": base_artifact_id,
                    },
                )
                image_results[name] = {
                    "status": "errored",
                    "head_hash": head_hash,
                    "base_hash": base_hash,
                    "reason": "exceeds_pixel_limit",
                }
                continue

            eligible.append(_DiffCandidate(name, head_hash, base_hash, pixel_count))

        logger.info(
            "compare_snapshots: image matching done",
            extra={
                "head_artifact_id": head_artifact_id,
                "matched": len(matched),
                "added": len(added),
                "removed": len(removed),
                "eligible_for_diff": len(eligible),
                "unchanged_count": unchanged_count,
                "error_count": error_count,
            },
        )

        batches = _create_pixel_batches(eligible, MAX_PIXELS_PER_BATCH)

        logger.info(
            "compare_snapshots: starting odiff, %d batches, %d pairs",
            len(batches),
            len(eligible),
            extra={"head_artifact_id": head_artifact_id},
        )

        # TODO: spawn N OdiffServer workers and distribute pairs across them
        # via a thread pool to parallelize the odiff comparison step per batch
        with OdiffServer() as server:
            for batch in batches:
                diff_pairs: list[tuple[bytes, bytes]] = []
                batch_names: list[str] = []
                batch_hashes: list[tuple[str, str]] = []

                for candidate in batch:
                    try:
                        head_data = session.get(
                            f"{image_key_prefix}/{candidate.head_hash}"
                        ).payload.read()
                        base_data = session.get(
                            f"{image_key_prefix}/{candidate.base_hash}"
                        ).payload.read()
                    except Exception:
                        logger.warning(
                            "compare_snapshots: failed to fetch images for %s",
                            candidate.name,
                            extra={
                                "head_artifact_id": head_artifact_id,
                                "head_hash": candidate.head_hash,
                                "base_hash": candidate.base_hash,
                            },
                        )
                        error_count += 1
                        image_results[candidate.name] = {
                            "status": "errored",
                            "head_hash": candidate.head_hash,
                            "base_hash": candidate.base_hash,
                            "reason": "image_fetch_failed",
                        }
                        continue
                    diff_pairs.append((base_data, head_data))
                    batch_names.append(candidate.name)
                    batch_hashes.append((candidate.head_hash, candidate.base_hash))

                logger.info(
                    "compare_snapshots: running batch of %d pairs",
                    len(diff_pairs),
                    extra={"head_artifact_id": head_artifact_id, "names": batch_names},
                )
                diff_results = compare_images_batch(diff_pairs, server=server)
                logger.info(
                    "compare_snapshots: batch complete, %d results",
                    len(diff_results),
                    extra={"head_artifact_id": head_artifact_id},
                )

                for name, (head_hash, base_hash), diff_result in zip(
                    batch_names, batch_hashes, diff_results, strict=True
                ):
                    if diff_result is None:
                        error_count += 1
                        image_results[name] = {
                            "status": "errored",
                            "head_hash": head_hash,
                            "base_hash": base_hash,
                            "reason": "image_processing_failed",
                        }
                        continue

                    stem = _image_name_to_path_stem(name)
                    diff_mask_key = (
                        f"{image_key_prefix}/{head_artifact_id}/{base_artifact_id}/diff/{stem}.png"
                    )
                    diff_mask_bytes = base64.b64decode(diff_result.diff_mask_png)
                    logger.info(
                        "compare_snapshots: uploading mask for %s (%d bytes, diff=%.4f, changed_px=%d)",
                        name,
                        len(diff_mask_bytes),
                        diff_result.diff_score,
                        diff_result.changed_pixels,
                        extra={
                            "head_artifact_id": head_artifact_id,
                            "diff_mask_key": diff_mask_key,
                        },
                    )
                    session.put(diff_mask_bytes, key=diff_mask_key, content_type="image/png")

                    is_changed = diff_result.changed_pixels > 0
                    if is_changed:
                        changed_count += 1
                    else:
                        unchanged_count += 1

                    diff_mask_image_id = f"{head_artifact_id}/{base_artifact_id}/diff/{stem}.png"

                    image_results[name] = {
                        "status": "changed" if is_changed else "unchanged",
                        "head_hash": head_hash,
                        "base_hash": base_hash,
                        "diff_score": diff_result.diff_score,
                        "changed_pixels": diff_result.changed_pixels,
                        "total_pixels": diff_result.total_pixels,
                        "diff_mask_key": diff_mask_key,
                        "diff_mask_image_id": diff_mask_image_id,
                        "before_width": diff_result.before_width,
                        "before_height": diff_result.before_height,
                        "after_width": diff_result.after_width,
                        "after_height": diff_result.after_height,
                        "aligned_height": diff_result.aligned_height,
                        "width": diff_result.width,
                    }

        for name in sorted(added):
            image_results[name] = {"status": "added", "head_hash": head_by_name[name]}

        for name in sorted(removed):
            base_hash = base_by_name[name]
            base_meta = base_images[base_hash]
            image_results[name] = {
                "status": "removed",
                "base_hash": base_hash,
                "before_width": base_meta.width,
                "before_height": base_meta.height,
            }

        comparison_manifest = {
            "head_artifact_id": head_artifact_id,
            "base_artifact_id": base_artifact_id,
            "summary": {
                "total": len(matched) + len(added) + len(removed),
                "changed": changed_count,
                "unchanged": unchanged_count,
                "added": len(added),
                "removed": len(removed),
                "errored": error_count,
            },
            "images": image_results,
        }

        comparison_key = (
            f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}/comparison.json"
        )
        session.put(
            orjson.dumps(comparison_manifest),
            key=comparison_key,
            content_type="application/json",
        )

        comparison.state = PreprodSnapshotComparison.State.SUCCESS
        comparison.error_code = None
        comparison.images_changed = changed_count
        comparison.images_unchanged = unchanged_count
        comparison.images_added = len(added)
        comparison.images_removed = len(removed)
        extras = comparison.extras or {}
        # EME-896: Could become a proper column on PreprodSnapshotComparison
        extras["comparison_key"] = comparison_key
        comparison.extras = extras
        comparison.save(
            update_fields=[
                "state",
                "error_code",
                "images_changed",
                "images_unchanged",
                "images_added",
                "images_removed",
                "extras",
                "date_updated",
            ]
        )

        logger.info(
            "Snapshot comparison complete",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "changed": changed_count,
                "unchanged": unchanged_count,
                "added": len(added),
                "removed": len(removed),
                "errored": error_count,
            },
        )

    except BaseException:
        logger.exception(
            "Snapshot comparison failed",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
            },
        )
        if comparison is not None:
            try:
                comparison.state = PreprodSnapshotComparison.State.FAILED
                comparison.error_code = PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR
                comparison.save(update_fields=["state", "error_code", "date_updated"])
            except Exception:
                logger.exception(
                    "Failed to save FAILED state for comparison",
                    extra={"comparison_id": comparison.id},
                )
        raise
