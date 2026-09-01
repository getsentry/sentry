from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, TypedDict

import orjson
from objectstore_client import Session

from sentry.preprod.api.models.public.snapshots import SnapshotImageResponseDict
from sentry.preprod.snapshots.image_serialization import build_head_image_dict
from sentry.utils.tracing import set_span_data, start_span

logger = logging.getLogger(__name__)

# Bump whenever the shape of a precomputed head-image dict changes, so stale blobs
# are treated as a cache miss and the read path rebuilds from the manifest.
HEAD_IMAGES_SCHEMA_VERSION = 1


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
        "images": [
            build_head_image_dict(image_file_name, metadata, diff_threshold)
            for image_file_name, metadata in sorted(images.items())
        ],
    }


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
            if payload.get("schema_version") != HEAD_IMAGES_SCHEMA_VERSION:
                return None
            images = payload["images"]
            set_span_data(span, "image_count", len(images))
            return images, payload.get("diff_threshold")
    except Exception:
        logger.exception("Failed to read precomputed head images", extra={"key": key})
        return None
