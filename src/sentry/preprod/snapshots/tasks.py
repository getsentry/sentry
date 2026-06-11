from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from difflib import SequenceMatcher
from typing import NamedTuple

import orjson
from django.contrib.postgres.fields import ArrayField
from django.db import IntegrityError, models
from django.db.models import F, Func, Value
from django.utils import timezone
from objectstore_client import RequestError, Session
from pydantic import BaseModel, ValidationError
from taskbroker_client.retry import Retry

from sentry.objectstore import get_preprod_session
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.image_diff.compare import DIFF_ALGORITHM_VERSION, compare_images_batch
from sentry.preprod.snapshots.image_diff.odiff import OdiffServer
from sentry.preprod.snapshots.manifest import (
    ChunkAssignment,
    ChunkCandidate,
    ChunkResult,
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonPlan,
    ComparisonSummary,
    SnapshotManifest,
)
from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotMetrics,
)
from sentry.preprod.vcs.tasks import update_preprod_snapshot_vcs
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)

MAX_DIFF_PIXELS = 40_000_000
MAX_PIXELS_PER_BATCH = 40_000_000

CHUNK_PROCESSING_DEADLINE = 120  # seconds; one ~40M-px batch finishes well under this

# Concurrent batch fetches/uploads make transient objectstore 429/503s likelier. Retry once
# (more would just amplify rate limiting); other errors (e.g. 404) fail fast.
_RETRYABLE_OBJECTSTORE_STATUSES = frozenset({429, 503})
_OBJECTSTORE_MAX_ATTEMPTS = 2
_OBJECTSTORE_RETRY_DELAY_S = 0.5


def _comparison_prefix(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int
) -> str:
    return f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}"


def _plan_key(org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/plan.json"


def _chunk_result_key(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int, chunk_index: int
) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/chunks/{chunk_index}.json"


def _comparison_key(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int
) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/comparison.json"


def _diff_mask_key(
    org_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int, stem: str
) -> str:
    return f"{_comparison_prefix(org_id, project_id, head_artifact_id, base_artifact_id)}/diff/{stem}.png"


def _retry_objectstore[T](operation: Callable[[], T]) -> T:
    for attempt in range(1, _OBJECTSTORE_MAX_ATTEMPTS + 1):
        try:
            return operation()
        except RequestError as e:
            if (
                e.status not in _RETRYABLE_OBJECTSTORE_STATUSES
                or attempt == _OBJECTSTORE_MAX_ATTEMPTS
            ):
                raise
            time.sleep(_OBJECTSTORE_RETRY_DELAY_S)
    raise AssertionError("unreachable")


def _get_json[T: BaseModel](session: Session, key: str, model_cls: type[T]) -> T:
    return model_cls(**orjson.loads(_retry_objectstore(lambda: session.get(key).payload.read())))


def _put_json(session: Session, key: str, model: BaseModel) -> None:
    _retry_objectstore(
        lambda: session.put(orjson.dumps(model.dict()), key=key, content_type="application/json")
    )


def _put_diff_mask(session: Session, key: str, data: bytes) -> None:
    _retry_objectstore(lambda: session.put(data, key=key, content_type="image/png"))


def _errored_result(candidate: ChunkCandidate, reason: str) -> ComparisonImageResult:
    return ComparisonImageResult(
        status="errored",
        head_hash=candidate.head_hash,
        base_hash=candidate.base_hash,
        reason=reason,
    )


def _mark_chunk_done(comparison_id: int, chunk_index: int) -> None:
    # date_updated is the comparison's progress signal: the reaper
    # (detect_expired_preprod_artifacts) fails rows whose date_updated goes stale,
    # so bumping it per completed chunk makes "stuck" mean "no chunk progress".
    PreprodSnapshotComparison.objects.filter(id=comparison_id).exclude(
        chunks_done_indices__contains=[chunk_index]
    ).update(
        chunks_done_indices=Func(
            F("chunks_done_indices"),
            Value([chunk_index], output_field=ArrayField(models.IntegerField())),
            function="array_cat",
            output_field=ArrayField(models.IntegerField()),
        ),
        date_updated=timezone.now(),
    )


class _DiffCandidate(NamedTuple):
    name: str
    head_hash: str
    base_hash: str
    pixel_count: int


class _ImageDiffResult(NamedTuple):
    renamed_pairs: list[tuple[str, str]]
    added: set[str]
    removed: set[str]
    matched: set[str]
    head_by_name: dict[str, str]
    base_by_name: dict[str, str]
    skipped: set[str]


# When multiple added/removed files share the same content hash (e.g. dark/light
# theme variants), greedily pair them by filename similarity for rename detection.
def _match_by_name_similarity(
    added_names: list[str], removed_names: list[str]
) -> list[tuple[str, str]]:
    scored: list[tuple[float, int, int]] = []
    for ai, a in enumerate(added_names):
        for ri, r in enumerate(removed_names):
            scored.append((SequenceMatcher(None, a, r).ratio(), ai, ri))

    scored.sort(reverse=True)

    pairs: list[tuple[str, str]] = []
    used_added: set[int] = set()
    used_removed: set[int] = set()

    for _, ai, ri in scored:
        if ai in used_added or ri in used_removed:
            continue
        pairs.append((added_names[ai], removed_names[ri]))
        used_added.add(ai)
        used_removed.add(ri)

    return pairs


def categorize_image_diff(
    head_manifest: SnapshotManifest, base_manifest: SnapshotManifest
) -> _ImageDiffResult:
    head_by_name = {key: meta.content_hash for key, meta in head_manifest.images.items()}
    base_by_name = {key: meta.content_hash for key, meta in base_manifest.images.items()}

    all_image_file_names = head_manifest.all_image_file_names

    matched = head_by_name.keys() & base_by_name.keys()
    added = head_by_name.keys() - base_by_name.keys()

    if all_image_file_names is not None:
        all_names_set = set(all_image_file_names)
        removed = base_by_name.keys() - all_names_set
        skipped = (all_names_set - head_by_name.keys()) & base_by_name.keys()
    elif head_manifest.selective:
        removed = set()
        skipped = base_by_name.keys() - head_by_name.keys()
    else:
        removed = base_by_name.keys() - head_by_name.keys()
        skipped = set()

    added_hash_to_names: dict[str, list[str]] = {}
    for name in added:
        h = head_by_name[name]
        added_hash_to_names.setdefault(h, []).append(name)

    removed_hash_to_names: dict[str, list[str]] = {}
    for name in removed:
        h = base_by_name[name]
        removed_hash_to_names.setdefault(h, []).append(name)

    renamed_pairs: list[tuple[str, str]] = []
    for h in added_hash_to_names.keys() & removed_hash_to_names.keys():
        a_names = added_hash_to_names[h]
        r_names = removed_hash_to_names[h]
        if len(a_names) == 1 and len(r_names) == 1:
            renamed_pairs.append((a_names[0], r_names[0]))
        else:
            renamed_pairs.extend(_match_by_name_similarity(a_names, r_names))

    for new_name, old_name in renamed_pairs:
        added.discard(new_name)
        removed.discard(old_name)
        h = head_by_name[new_name]
        if h in added_hash_to_names:
            names = added_hash_to_names[h]
            if new_name in names:
                names.remove(new_name)
            if not names:
                del added_hash_to_names[h]

    if skipped:
        skipped_hash_to_names: dict[str, list[str]] = {}
        for name in skipped:
            h = base_by_name[name]
            skipped_hash_to_names.setdefault(h, []).append(name)

        for h in added_hash_to_names.keys() & skipped_hash_to_names.keys():
            a_names = added_hash_to_names[h]
            s_names = skipped_hash_to_names[h]
            if len(a_names) == 1 and len(s_names) == 1:
                matched_pairs = [(a_names[0], s_names[0])]
            else:
                matched_pairs = _match_by_name_similarity(a_names, s_names)
            for a_name, s_name in matched_pairs:
                renamed_pairs.append((a_name, s_name))
                added.discard(a_name)
                skipped.discard(s_name)

    return _ImageDiffResult(
        renamed_pairs, added, removed, matched, head_by_name, base_by_name, skipped
    )


def _image_name_to_path_stem(name: str) -> str:
    normalized = name.replace("\\", "/").strip("/")
    return normalized.rsplit(".", 1)[0] if "." in normalized else normalized


def _fetch_batch_images(
    session: Session,
    key_prefix: str,
    hashes: set[str],
) -> tuple[dict[str, bytes], set[str]]:
    cache: dict[str, bytes] = {}
    failed: set[str] = set()
    lock = threading.Lock()

    def fetch(image_hash: str) -> None:
        try:
            key = f"{key_prefix}/{image_hash}"
            data = _retry_objectstore(lambda: session.get(key).payload.read())
            with lock:
                cache[image_hash] = data
        except Exception:
            with lock:
                failed.add(image_hash)

    with ContextPropagatingThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(fetch, hashes))

    return cache, failed


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


class ImageFingerprint(NamedTuple):
    name: str
    status: str
    head_hash: str | None = None
    previous_image_file_name: str | None = None


def _build_comparison_fingerprints(manifest: ComparisonManifest) -> set[ImageFingerprint]:
    fingerprints: set[ImageFingerprint] = set()
    for name, image in manifest.images.items():
        if image.status in ("unchanged", "skipped"):
            continue
        if image.status in ("changed", "added"):
            if not image.head_hash:
                continue
            fingerprints.add(ImageFingerprint(name, image.status, image.head_hash))
        elif image.status == "renamed":
            if not image.head_hash or not image.previous_image_file_name:
                continue
            fingerprints.add(
                ImageFingerprint(name, "renamed", image.head_hash, image.previous_image_file_name)
            )
        else:
            fingerprints.add(ImageFingerprint(name, image.status))
    return fingerprints


def _try_auto_approve_snapshot(
    head_artifact: PreprodArtifact,
    comparison_manifest: ComparisonManifest,
    session: Session,
) -> None:
    cc = head_artifact.commit_comparison
    if not cc or not cc.pr_number or not cc.head_repo_name:
        return

    head_fingerprints = _build_comparison_fingerprints(comparison_manifest)
    if not head_fingerprints:
        return

    approved_sibling = (
        PreprodArtifact.objects.filter(
            project_id=head_artifact.project_id,
            app_id=head_artifact.app_id,
            build_configuration=head_artifact.build_configuration,
            commit_comparison__pr_number=cc.pr_number,
            commit_comparison__head_repo_name=cc.head_repo_name,
            preprodcomparisonapproval__preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            preprodcomparisonapproval__approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=PreprodSnapshotComparison.State.SUCCESS,
        )
        .exclude(id=head_artifact.id)
        .order_by("-date_added")
        .first()
    )

    if not approved_sibling:
        return

    sibling_comparison = (
        PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics__preprod_artifact=approved_sibling,
            state=PreprodSnapshotComparison.State.SUCCESS,
        )
        .order_by("-date_updated")
        .first()
    )

    if not sibling_comparison:
        return

    sibling_comparison_key = (sibling_comparison.extras or {}).get("comparison_key")
    if not sibling_comparison_key:
        return

    try:
        sibling_manifest = ComparisonManifest(
            **orjson.loads(session.get(sibling_comparison_key).payload.read())
        )
    except Exception:
        logger.exception(
            "auto_approve: failed to load sibling comparison manifest",
            extra={
                "head_artifact_id": head_artifact.id,
                "sibling_artifact_id": approved_sibling.id,
                "comparison_key": sibling_comparison_key,
            },
        )
        return

    sibling_fingerprints = _build_comparison_fingerprints(sibling_manifest)

    if head_fingerprints != sibling_fingerprints:
        logger.info(
            "auto_approve: fingerprints do not match",
            extra={
                "head_artifact_id": head_artifact.id,
                "sibling_artifact_id": approved_sibling.id,
            },
        )
        return

    PreprodComparisonApproval.objects.create(
        preprod_artifact=head_artifact,
        preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
        approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        approved_at=timezone.now(),
        extras={
            "auto_approval": True,
            "prev_approved_artifact_id": approved_sibling.id,
        },
    )

    logger.info(
        "auto_approve: snapshot auto-approved",
        extra={
            "head_artifact_id": head_artifact.id,
            "prev_approved_artifact_id": approved_sibling.id,
            "organization_slug": head_artifact.project.organization.slug,
        },
    )


def _build_comparison_plan(
    head_manifest: SnapshotManifest,
    base_manifest: SnapshotManifest,
    head_artifact_id: int,
    base_artifact_id: int,
) -> ComparisonPlan:
    diff_threshold = head_manifest.diff_threshold

    head_images = head_manifest.images
    base_images = base_manifest.images

    head_meta_by_hash = {m.content_hash: m for m in head_images.values()}
    base_meta_by_hash = {m.content_hash: m for m in base_images.values()}

    categories = categorize_image_diff(head_manifest, base_manifest)
    renamed_pairs = categories.renamed_pairs
    added = categories.added
    removed = categories.removed
    matched = categories.matched
    head_by_name = categories.head_by_name
    base_by_name = categories.base_by_name
    skipped = categories.skipped

    non_diff_images: dict[str, ComparisonImageResult] = {}
    eligible: list[_DiffCandidate] = []
    eligible_thresholds: dict[str, float] = {}

    for name in sorted(matched):
        head_hash = head_by_name[name]
        base_hash = base_by_name[name]

        if head_hash == base_hash:
            non_diff_images[name] = ComparisonImageResult(
                status="unchanged",
                head_hash=head_hash,
                base_hash=base_hash,
            )
            continue

        head_meta = head_meta_by_hash[head_hash]
        base_meta = base_meta_by_hash[base_hash]
        head_pixels = head_meta.width * head_meta.height
        base_pixels = base_meta.width * base_meta.height
        pixel_count = max(head_pixels, base_pixels)

        if pixel_count > MAX_DIFF_PIXELS:
            non_diff_images[name] = ComparisonImageResult(
                status="errored",
                head_hash=head_hash,
                base_hash=base_hash,
                reason="exceeds_pixel_limit",
            )
            continue

        specific_image_diff_threshold = head_images[name].diff_threshold
        effective_threshold = (
            specific_image_diff_threshold
            if specific_image_diff_threshold is not None
            else diff_threshold
            if diff_threshold is not None
            else 0.0
        )
        eligible.append(_DiffCandidate(name, head_hash, base_hash, pixel_count))
        eligible_thresholds[name] = effective_threshold

    for name in sorted(added):
        non_diff_images[name] = ComparisonImageResult(
            status="added",
            head_hash=head_by_name[name],
        )

    for name in sorted(removed):
        base_hash = base_by_name[name]
        base_meta = base_meta_by_hash[base_hash]
        non_diff_images[name] = ComparisonImageResult(
            status="removed",
            base_hash=base_hash,
            before_width=base_meta.width,
            before_height=base_meta.height,
        )

    for name in sorted(skipped):
        base_hash = base_by_name[name]
        base_meta = base_meta_by_hash[base_hash]
        non_diff_images[name] = ComparisonImageResult(
            status="skipped",
            base_hash=base_hash,
            before_width=base_meta.width,
            before_height=base_meta.height,
        )

    for new_name, old_name in sorted(renamed_pairs):
        non_diff_images[new_name] = ComparisonImageResult(
            status="renamed",
            head_hash=head_by_name[new_name],
            previous_image_file_name=old_name,
        )

    batches = _create_pixel_batches(eligible, MAX_PIXELS_PER_BATCH)
    chunks = [
        ChunkAssignment(
            chunk_index=i,
            candidates=[
                ChunkCandidate(
                    name=candidate.name,
                    head_hash=candidate.head_hash,
                    base_hash=candidate.base_hash,
                    pixel_count=candidate.pixel_count,
                    diff_threshold=eligible_thresholds[candidate.name],
                )
                for candidate in batch
            ],
        )
        for i, batch in enumerate(batches)
    ]

    return ComparisonPlan(
        head_artifact_id=head_artifact_id,
        base_artifact_id=base_artifact_id,
        chunks=chunks,
        non_diff_images=non_diff_images,
    )


def _process_chunk(
    session: Session,
    assignment: ChunkAssignment,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> dict[str, ComparisonImageResult]:
    image_key_prefix = f"{org_id}/{project_id}"
    images: dict[str, ComparisonImageResult] = {}

    with OdiffServer() as server:
        diff_pairs: list[tuple[bytes, bytes]] = []
        batch_names: list[str] = []
        batch_hashes: list[tuple[str, str]] = []
        batch_thresholds: list[float] = []

        unique_hashes: set[str] = set()
        for candidate in assignment.candidates:
            unique_hashes.add(candidate.head_hash)
            unique_hashes.add(candidate.base_hash)

        fetch_cache, failed_hashes = _fetch_batch_images(session, image_key_prefix, unique_hashes)

        for candidate in assignment.candidates:
            if candidate.head_hash in failed_hashes or candidate.base_hash in failed_hashes:
                images[candidate.name] = ComparisonImageResult(
                    status="errored",
                    head_hash=candidate.head_hash,
                    base_hash=candidate.base_hash,
                    reason="image_fetch_failed",
                )
                continue
            head_data = fetch_cache[candidate.head_hash]
            base_data = fetch_cache[candidate.base_hash]
            diff_pairs.append((base_data, head_data))
            batch_names.append(candidate.name)
            batch_hashes.append((candidate.head_hash, candidate.base_hash))
            batch_thresholds.append(candidate.diff_threshold)

        diff_results = compare_images_batch(diff_pairs, server=server)

        for name, (head_hash, base_hash), threshold, diff_result in zip(
            batch_names, batch_hashes, batch_thresholds, diff_results, strict=True
        ):
            if diff_result is None:
                images[name] = ComparisonImageResult(
                    status="errored",
                    head_hash=head_hash,
                    base_hash=base_hash,
                    reason="image_processing_failed",
                )
                continue

            stem = _image_name_to_path_stem(name)
            diff_mask_key = _diff_mask_key(
                org_id, project_id, head_artifact_id, base_artifact_id, stem
            )
            diff_mask_bytes = diff_result.diff_mask_png
            _put_diff_mask(session, diff_mask_key, diff_mask_bytes)

            diff_pct = (
                diff_result.changed_pixels / diff_result.total_pixels
                if diff_result.total_pixels > 0
                else 0
            )
            is_changed = diff_pct > threshold

            diff_mask_image_id = f"{head_artifact_id}/{base_artifact_id}/diff/{stem}.png"

            if not is_changed:
                metrics.incr("preprod.snapshots.odiff.unchanged_with_diff_hash")
                logger.info(
                    "preprod.snapshots.odiff.unchanged_with_diff_hash",
                    extra={
                        "name": name,
                        "org_id": org_id,
                        "head_artifact_id": head_artifact_id,
                        "base_artifact_id": base_artifact_id,
                        "head_hash": head_hash,
                        "base_hash": base_hash,
                        "changed_pixels": diff_result.changed_pixels,
                        "threshold": threshold,
                    },
                )

            images[name] = ComparisonImageResult(
                status="changed" if is_changed else "unchanged",
                head_hash=head_hash,
                base_hash=base_hash,
                changed_pixels=diff_result.changed_pixels,
                total_pixels=diff_result.total_pixels,
                diff_mask_key=diff_mask_key,
                diff_mask_image_id=diff_mask_image_id,
                before_width=diff_result.before_width,
                before_height=diff_result.before_height,
                after_width=diff_result.after_width,
                after_height=diff_result.after_height,
                aligned_height=diff_result.aligned_height,
            )

    return images


@instrumented_task(
    name="sentry.preprod.tasks.process_snapshot_comparison_chunk",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=CHUNK_PROCESSING_DEADLINE,
)
def process_snapshot_comparison_chunk(
    comparison_id: int,
    chunk_index: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    session = get_preprod_session(org_id, project_id)
    plan_key = _plan_key(org_id, project_id, head_artifact_id, base_artifact_id)

    try:
        # The plan read is inside the try so a missing/corrupt plan still marks the chunk
        # done (with no result blob), letting finalize degrade it to errored rather than
        # leaving the comparison stuck in PROCESSING for the reaper.
        plan = _get_json(session, plan_key, ComparisonPlan)
        assignment = next((c for c in plan.chunks if c.chunk_index == chunk_index), None)
        if assignment is not None:
            images = _process_chunk(
                session, assignment, org_id, project_id, head_artifact_id, base_artifact_id
            )
            result_key = _chunk_result_key(
                org_id, project_id, head_artifact_id, base_artifact_id, chunk_index
            )
            _put_json(session, result_key, ChunkResult(chunk_index=chunk_index, images=images))
    except Exception:
        # Record the chunk as terminally failed so the comparison can still
        # complete: finalize degrades a done chunk with no result blob to errored.
        # Processing-deadline timeouts raise BaseException and propagate past this
        # handler, so the broker can still retry them.
        logger.exception(
            "compare_snapshots: chunk failed",
            extra={"comparison_id": comparison_id, "chunk_index": chunk_index},
        )

    _mark_chunk_done(comparison_id, chunk_index)

    _finalize_if_all_chunks_done(
        comparison_id, org_id, project_id, head_artifact_id, base_artifact_id
    )


@instrumented_task(
    name="sentry.preprod.tasks.compare_snapshots",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
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
        head_artifact = PreprodArtifact.objects.select_related("project__organization").get(
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
        update_preprod_snapshot_vcs(
            preprod_artifact_id=head_artifact_id,
            caller="compare_failure",
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
        update_preprod_snapshot_vcs(
            preprod_artifact_id=head_artifact_id,
            caller="compare_failure",
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
            update_preprod_snapshot_vcs(
                preprod_artifact_id=head_artifact_id,
                caller="compare_failure",
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
        ).update(
            state=PreprodSnapshotComparison.State.PROCESSING,
            date_updated=timezone.now(),
        )
        resumed = 0
        if not updated:
            # A PROCESSING row whose orchestration never set chunks_total is stuck; reclaim
            # it. Orchestration is idempotent, so concurrent resumers are safe.
            resumed = PreprodSnapshotComparison.objects.filter(
                id=comparison.id,
                state=PreprodSnapshotComparison.State.PROCESSING,
                chunks_total__isnull=True,
            ).update(date_updated=timezone.now())
        if not updated and not resumed:
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

    update_preprod_snapshot_vcs(
        preprod_artifact_id=head_artifact_id,
        caller="compare_start",
        update_pr_comment=False,
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
            head_manifest = _get_json(session, head_manifest_key, SnapshotManifest)
            base_manifest = _get_json(session, base_manifest_key, SnapshotManifest)
        except (orjson.JSONDecodeError, RequestError, ValidationError, TypeError):
            logger.exception(
                "compare_snapshots: failed to load or parse manifest",
                extra={
                    "head_artifact_id": head_artifact_id,
                    "base_artifact_id": base_artifact_id,
                },
            )
            failed = PreprodSnapshotComparison.objects.filter(
                id=comparison.id,
                state=PreprodSnapshotComparison.State.PROCESSING,
            ).update(
                state=PreprodSnapshotComparison.State.FAILED,
                error_code=PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR,
                date_updated=timezone.now(),
            )
            if failed:
                update_preprod_snapshot_vcs(
                    preprod_artifact_id=head_artifact_id,
                    caller="compare_failure",
                )
            return

        plan = _build_comparison_plan(
            head_manifest, base_manifest, head_artifact_id, base_artifact_id
        )

        plan_key = _plan_key(org_id, project_id, head_artifact_id, base_artifact_id)
        _put_json(session, plan_key, plan)

        for assignment in plan.chunks:
            process_snapshot_comparison_chunk.apply_async(
                kwargs={
                    "comparison_id": comparison.id,
                    "chunk_index": assignment.chunk_index,
                    "org_id": org_id,
                    "project_id": project_id,
                    "head_artifact_id": head_artifact_id,
                    "base_artifact_id": base_artifact_id,
                }
            )

        comparison.chunks_total = len(plan.chunks)
        comparison.save(update_fields=["chunks_total", "date_updated"])

        logger.info(
            "compare_snapshots: orchestration dispatched",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "chunks_total": len(plan.chunks),
            },
        )

        # A chunk finalizes when it records the last completion, but the chunks
        # dispatched above may have already finished while chunks_total was still
        # None (and so skipped finalize), and a plan with no diff chunks never
        # triggers one at all. Now that chunks_total is set, close both gaps here;
        # the finalize gate is idempotent.
        _finalize_if_all_chunks_done(
            comparison.id, org_id, project_id, head_artifact_id, base_artifact_id
        )

    except BaseException:
        logger.exception(
            "Snapshot comparison failed",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "organization_slug": head_artifact.project.organization.slug,
            },
        )
        failed = 0
        if comparison is not None:
            try:
                failed = PreprodSnapshotComparison.objects.filter(
                    id=comparison.id,
                    state=PreprodSnapshotComparison.State.PROCESSING,
                ).update(
                    state=PreprodSnapshotComparison.State.FAILED,
                    error_code=PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR,
                    date_updated=timezone.now(),
                )
            except Exception:
                logger.exception(
                    "Failed to save FAILED state for comparison",
                    extra={"comparison_id": comparison.id},
                )

        if failed:
            update_preprod_snapshot_vcs(
                preprod_artifact_id=head_artifact_id,
                caller="compare_failure",
            )
        raise


def _finalize_if_all_chunks_done(
    comparison_id: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    comparison = PreprodSnapshotComparison.objects.filter(id=comparison_id).first()
    if comparison is None or comparison.state != PreprodSnapshotComparison.State.PROCESSING:
        return
    if comparison.chunks_total is None:
        return
    if len(comparison.chunks_done_indices) < comparison.chunks_total:
        return
    # Concurrent final chunks (or the orchestrator) may each pass this check and
    # dispatch a finalize; the PROCESSING->SUCCESS compare-and-swap in
    # finalize_snapshot_comparison is the real exactly-once gate.
    finalize_snapshot_comparison.apply_async(
        kwargs={
            "comparison_id": comparison_id,
            "org_id": org_id,
            "project_id": project_id,
            "head_artifact_id": head_artifact_id,
            "base_artifact_id": base_artifact_id,
        }
    )


@instrumented_task(
    name="sentry.preprod.tasks.finalize_snapshot_comparison",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=300,
)
def finalize_snapshot_comparison(
    comparison_id: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    comparison = PreprodSnapshotComparison.objects.filter(id=comparison_id).first()
    if comparison is None:
        return
    if comparison.state in (
        PreprodSnapshotComparison.State.SUCCESS,
        PreprodSnapshotComparison.State.FAILED,
    ):
        return
    if comparison.chunks_total is None:
        return
    if len(comparison.chunks_done_indices) < comparison.chunks_total:
        return
    # Heartbeat before the (potentially slow) assembly so a finalize that was
    # queued near the reaper's staleness window is not failed out from under
    # itself mid-run.
    PreprodSnapshotComparison.objects.filter(
        id=comparison.id, state=PreprodSnapshotComparison.State.PROCESSING
    ).update(date_updated=timezone.now())

    comparison.refresh_from_db(fields=["chunks_done_indices"])
    session = get_preprod_session(org_id, project_id)
    plan_key = _plan_key(org_id, project_id, head_artifact_id, base_artifact_id)
    try:
        plan = _get_json(session, plan_key, ComparisonPlan)
    except (orjson.JSONDecodeError, RequestError, ValidationError, TypeError):
        # Without the plan there are no chunks to assemble, so this is unrecoverable.
        # Fail the row cleanly instead of leaving it PROCESSING for the reaper to sweep
        # ~30min later (the chunk-result read below degrades for the same reason).
        logger.exception(
            "finalize: failed to read comparison plan, failing comparison",
            extra={"comparison_id": comparison.id},
        )
        failed = PreprodSnapshotComparison.objects.filter(
            id=comparison.id, state=PreprodSnapshotComparison.State.PROCESSING
        ).update(
            state=PreprodSnapshotComparison.State.FAILED,
            error_code=PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR,
            date_updated=timezone.now(),
        )
        if failed:
            update_preprod_snapshot_vcs(
                preprod_artifact_id=head_artifact_id,
                caller="compare_failure",
            )
        return

    images: dict[str, ComparisonImageResult] = dict(plan.non_diff_images)
    done_set = set(comparison.chunks_done_indices)

    for assignment in plan.chunks:
        idx = assignment.chunk_index
        if idx in done_set:
            chunk_result_key = _chunk_result_key(
                org_id, project_id, head_artifact_id, base_artifact_id, idx
            )
            try:
                result = _get_json(session, chunk_result_key, ChunkResult)
            except (orjson.JSONDecodeError, RequestError, ValidationError, TypeError):
                # A done chunk whose result blob is missing/evicted/corrupt must not crash
                # finalize, otherwise the comparison stays PROCESSING forever and every retry
                # re-raises. Degrade its candidates to errored, mirroring the failed branch.
                logger.exception(
                    "finalize: failed to read done chunk result, degrading to errored",
                    extra={"comparison_id": comparison.id, "chunk_index": idx},
                )
                for candidate in assignment.candidates:
                    images[candidate.name] = _errored_result(candidate, "chunk_result_unreadable")
                continue
            images.update(result.images)
        else:
            for candidate in assignment.candidates:
                images[candidate.name] = _errored_result(candidate, "chunk_failed")

    counts = {
        s: 0 for s in ("changed", "unchanged", "added", "removed", "errored", "renamed", "skipped")
    }
    for image_result in images.values():
        if image_result.status in counts:
            counts[image_result.status] += 1

    comparison_manifest = ComparisonManifest(
        head_artifact_id=head_artifact_id,
        base_artifact_id=base_artifact_id,
        summary=ComparisonSummary(total=len(images), **counts),
        images=images,
    )
    comparison_key = _comparison_key(org_id, project_id, head_artifact_id, base_artifact_id)
    _put_json(session, comparison_key, comparison_manifest)

    extras = comparison.extras or {}
    extras["comparison_key"] = comparison_key
    extras["diff_algorithm_version"] = DIFF_ALGORITHM_VERSION
    updated = PreprodSnapshotComparison.objects.filter(
        id=comparison.id, state=PreprodSnapshotComparison.State.PROCESSING
    ).update(
        state=PreprodSnapshotComparison.State.SUCCESS,
        error_code=None,
        images_changed=counts["changed"],
        images_unchanged=counts["unchanged"],
        images_added=counts["added"],
        images_removed=counts["removed"],
        images_renamed=counts["renamed"],
        images_skipped=counts["skipped"],
        extras=extras,
        date_updated=timezone.now(),
    )
    if updated:
        logger.debug(
            "compare_snapshots: finalized",
            extra={
                "comparison_id": comparison.id,
                "done": len(done_set),
                "chunks_total": comparison.chunks_total,
                "images_changed": counts["changed"],
                "images_added": counts["added"],
                "images_removed": counts["removed"],
                "images_unchanged": counts["unchanged"],
                "images_renamed": counts["renamed"],
                "images_skipped": counts["skipped"],
                "images_errored": counts["errored"],
            },
        )
        try:
            head_artifact = PreprodArtifact.objects.select_related("project__organization").get(
                id=head_artifact_id,
                project__organization_id=org_id,
                project_id=project_id,
            )
        except PreprodArtifact.DoesNotExist:
            logger.warning(
                "compare_snapshots: head artifact deleted before finalize side effects",
                extra={"comparison_id": comparison.id, "head_artifact_id": head_artifact_id},
            )
            return

        metric_tags = {
            "app_id_temp": head_artifact.app_id or "",
        }

        e2e_duration_s = (timezone.now() - head_artifact.date_added).total_seconds()
        metrics.distribution(
            "preprod.snapshots.e2e_duration_s",
            e2e_duration_s,
            sample_rate=1.0,
            tags=metric_tags,
        )

        if (
            counts["changed"] == 0
            and counts["added"] == 0
            and counts["removed"] == 0
            and counts["renamed"] == 0
            and counts["errored"] == 0
        ):
            metrics.incr("preprod.snapshots.diff.zero_changes", sample_rate=1.0, tags=metric_tags)

        try:
            _try_auto_approve_snapshot(head_artifact, comparison_manifest, session)
        except Exception:
            logger.exception(
                "Auto-approve failed after successful comparison",
                extra={"head_artifact_id": head_artifact_id},
            )

        # Best-effort: the row is already SUCCESS, so a raise here would only no-op on retry.
        try:
            update_preprod_snapshot_vcs(
                preprod_artifact_id=head_artifact_id, caller="compare_completion"
            )
        except Exception:
            logger.exception(
                "compare_completion VCS update failed after successful comparison",
                extra={"head_artifact_id": head_artifact_id, "comparison_id": comparison.id},
            )
