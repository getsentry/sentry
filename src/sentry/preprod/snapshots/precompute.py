from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from typing import Any, TypedDict

import orjson
from objectstore_client import Session

from sentry.preprod.api.models.public.snapshots import (
    SnapshotDiffPairResponseDict,
    SnapshotImageResponseDict,
)
from sentry.preprod.snapshots.comparison_categorizer import CategorizedComparison
from sentry.preprod.snapshots.image_serialization import build_head_image_list
from sentry.utils.tracing import set_span_data, start_span

logger = logging.getLogger(__name__)

HEAD_IMAGES_SCHEMA_VERSION = 1
COMPARISON_SCHEMA_VERSION = 1

_COMPARISON_BUCKETS = (
    "added",
    "removed",
    "renamed",
    "changed",
    "unchanged",
    "errored",
    "skipped",
)


class HeadImagesPayload(TypedDict):
    schema_version: int
    diff_threshold: float | None
    images: list[SnapshotImageResponseDict]


def head_images_key(organization_id: int, project_id: int, artifact_id: int) -> str:
    return f"{organization_id}/{project_id}/{artifact_id}/snapshot_head_images.json"


def build_head_images_payload(
    images: Mapping[str, Any], diff_threshold: float | None
) -> HeadImagesPayload:
    return {
        "schema_version": HEAD_IMAGES_SCHEMA_VERSION,
        "diff_threshold": diff_threshold,
        "images": build_head_image_list(images, diff_threshold),
    }


def refresh_expiration(session: Session, keys: Iterable[str | None]) -> None:
    for key in keys:
        if not key:
            continue
        try:
            session.head(key)
        except Exception:
            logger.exception("Failed to refresh expiration", extra={"key": key})


def refresh_manifest_expiration(session: Session, manifest_key: str | None) -> None:
    refresh_expiration(session, (manifest_key,))


def load_precomputed_head_images(
    session: Session, key: str | None
) -> tuple[list[SnapshotImageResponseDict], float | None] | None:
    if not key:
        return None
    try:
        response = session.get(key)
        if response is None:
            return None
        with start_span(
            op="preprod.snapshot.read_precomputed_head_images",
            name="read_precomputed_head_images",
        ) as span:
            raw = response.payload.read()
            payload = orjson.loads(raw)
            if (
                payload.get("schema_version") != HEAD_IMAGES_SCHEMA_VERSION
                or "images" not in payload
            ):
                return None
            images = payload["images"]
            set_span_data(span, "image_count", len(images))
            return images, payload.get("diff_threshold")
    except Exception:
        logger.exception("Failed to read precomputed head images", extra={"key": key})
        return None


class ComparisonPayload(TypedDict):
    schema_version: int
    comparison_type: str
    base_artifact_id: str | None
    diff_threshold: float | None
    added: list[SnapshotImageResponseDict]
    removed: list[SnapshotImageResponseDict]
    renamed: list[SnapshotDiffPairResponseDict]
    changed: list[SnapshotDiffPairResponseDict]
    unchanged: list[SnapshotImageResponseDict]
    errored: list[SnapshotDiffPairResponseDict]
    skipped: list[SnapshotImageResponseDict]


def comparison_response_key(
    organization_id: int, project_id: int, head_artifact_id: int, base_artifact_id: int
) -> str:
    return (
        f"{organization_id}/{project_id}/{head_artifact_id}/{base_artifact_id}"
        "/snapshot_comparison_response.json"
    )


def build_comparison_payload(
    categorized: CategorizedComparison,
    comparison_type: str,
    base_artifact_id: str | None,
    diff_threshold: float | None,
) -> ComparisonPayload:
    return {
        "schema_version": COMPARISON_SCHEMA_VERSION,
        "comparison_type": comparison_type,
        "base_artifact_id": base_artifact_id,
        "diff_threshold": diff_threshold,
        "added": categorized.added,
        "removed": categorized.removed,
        "renamed": categorized.renamed,
        "changed": categorized.changed,
        "unchanged": categorized.unchanged,
        "errored": categorized.errored,
        "skipped": categorized.skipped,
    }


def load_precomputed_comparison(session: Session, key: str | None) -> ComparisonPayload | None:
    if not key:
        return None
    try:
        response = session.get(key)
        if response is None:
            return None
        with start_span(
            op="preprod.snapshot.read_precomputed_comparison",
            name="read_precomputed_comparison",
        ) as span:
            payload = orjson.loads(response.payload.read())
            if payload.get("schema_version") != COMPARISON_SCHEMA_VERSION or not all(
                bucket in payload for bucket in _COMPARISON_BUCKETS
            ):
                return None
            set_span_data(
                span, "image_count", sum(len(payload[bucket]) for bucket in _COMPARISON_BUCKETS)
            )
            return payload
    except Exception:
        logger.exception("Failed to read precomputed comparison", extra={"key": key})
        return None
