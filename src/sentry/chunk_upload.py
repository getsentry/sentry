from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from django.utils import timezone

from sentry.objectstore import get_chunk_upload_session
from sentry.utils.tracing import set_span_data, set_span_tag, start_span

if TYPE_CHECKING:
    from sentry_redis_tools.clients import RedisCluster


CHUNK_UPLOAD_OBJECTSTORE_TTL = timedelta(days=1)
CHUNK_UPLOAD_OBJECTSTORE_EXPIRY_SAFETY_WINDOW = timedelta(hours=1)


def get_chunk_upload_objectstore_intent_key(organization_id: int, checksum: str) -> str:
    return f"chunk-upload-objectstore:{organization_id}:{checksum}"


def get_chunk_upload_objectstore_mode_key(organization_id: int) -> str:
    return f"chunk-upload-objectstore-mode:{organization_id}"


def _get_assemble_redis_cluster() -> RedisCluster:
    # Objectstore upload intents share the assemble status cluster.
    from sentry.tasks.assemble import _get_redis_cluster_for_assemble

    return _get_redis_cluster_for_assemble()


def set_chunk_upload_objectstore_intents(organization_id: int, checksums: Iterable[str]) -> None:
    checksums = set(checksums)
    if not checksums:
        return

    pipeline = _get_assemble_redis_cluster().pipeline(transaction=False)
    for checksum in checksums:
        pipeline.set(
            name=get_chunk_upload_objectstore_intent_key(organization_id, checksum),
            value="1",
            ex=CHUNK_UPLOAD_OBJECTSTORE_TTL,
        )
    pipeline.execute()


def get_chunk_upload_objectstore_mode(organization_id: int, use_objectstore: bool) -> bool:
    """Pins the Objectstore assembly mode for an organization during the rollout."""
    client = _get_assemble_redis_cluster()
    key = get_chunk_upload_objectstore_mode_key(organization_id)
    mode = client.get(key)
    if mode is None:
        value = b"1" if use_objectstore else b"0"
        if client.set(key, value, ex=CHUNK_UPLOAD_OBJECTSTORE_TTL, nx=True):
            return use_objectstore
        mode = client.get(key)

    return mode == b"1"


def get_chunk_upload_objectstore_intents(
    organization_id: int, checksums: Iterable[str]
) -> set[str]:
    checksums = set(checksums)
    if not checksums:
        return set()

    pipeline = _get_assemble_redis_cluster().pipeline(transaction=False)
    ordered_checksums = list(checksums)
    for checksum in ordered_checksums:
        pipeline.get(name=get_chunk_upload_objectstore_intent_key(organization_id, checksum))
    return {
        checksum
        for checksum, intent in zip(ordered_checksums, pipeline.execute(), strict=True)
        if intent is not None
    }


def delete_chunk_upload_objectstore_intents(organization_id: int, checksums: Iterable[str]) -> None:
    checksums = set(checksums)
    if not checksums:
        return

    pipeline = _get_assemble_redis_cluster().pipeline(transaction=False)
    for checksum in checksums:
        pipeline.delete(get_chunk_upload_objectstore_intent_key(organization_id, checksum))
    pipeline.execute()


def _has_valid_chunk_expiry(time_expires: datetime | None, now: datetime) -> bool:
    return (
        time_expires is not None
        and timezone.is_aware(time_expires)
        and time_expires >= now + CHUNK_UPLOAD_OBJECTSTORE_EXPIRY_SAFETY_WINDOW
    )


def find_missing_objectstore_chunks(organization_id: int, chunks: Iterable[str]) -> list[str]:
    """Returns chunks that are absent or too close to expiry for assembly."""
    chunks = set(chunks)
    with start_span(
        op="find_missing_objectstore_chunks", name="find_missing_objectstore_chunks"
    ) as span:
        set_span_tag(span, "organization_id", organization_id)
        set_span_data(span, "chunks_size", len(chunks))

        if not chunks:
            return []

        session = get_chunk_upload_session(organization_id)
        now = timezone.now()
        missing_chunks = []
        # TODO: Replace this with Objectstore batch HEAD once client and server support it.
        for chunk in chunks:
            metadata = session.head(chunk)
            if metadata is None or not _has_valid_chunk_expiry(metadata.time_expires, now):
                missing_chunks.append(chunk)

        set_chunk_upload_objectstore_intents(organization_id, missing_chunks)
        return missing_chunks
