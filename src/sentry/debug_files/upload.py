from __future__ import annotations

from collections.abc import Iterable, Set
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from django.utils import timezone

from sentry.models.files import FileBlob
from sentry.objectstore import get_debug_file_chunks_session
from sentry.utils.tracing import set_span_data, set_span_tag, start_span

if TYPE_CHECKING:
    from sentry_redis_tools.clients import RedisCluster


DEBUG_FILE_CHUNK_UPLOAD_INTENT_TTL = timedelta(days=1)
DEBUG_FILE_CHUNK_EXPIRY_SAFETY_WINDOW = timedelta(hours=1)


def debug_file_chunk_key(checksum: str) -> str:
    return f"sha1/{checksum}"


def get_debug_file_chunk_upload_intent_key(organization_id: int, checksum: str) -> str:
    return f"chunk-upload-debug-file-intent:{organization_id}:{checksum}"


def _get_assemble_redis_cluster() -> RedisCluster:
    # Chunk upload intent markers deliberately share the assemble status cluster.
    from sentry.tasks.assemble import _get_redis_cluster_for_assemble

    return _get_redis_cluster_for_assemble()


def set_debug_file_chunk_upload_intents(organization_id: int, checksums: Iterable[str]) -> None:
    checksums = set(checksums)
    if not checksums:
        return

    pipeline = _get_assemble_redis_cluster().pipeline(transaction=False)
    for checksum in checksums:
        pipeline.set(
            name=get_debug_file_chunk_upload_intent_key(organization_id, checksum),
            value="1",
            ex=DEBUG_FILE_CHUNK_UPLOAD_INTENT_TTL,
        )
    pipeline.execute()


def get_debug_file_chunk_upload_intents(organization_id: int, checksums: Iterable[str]) -> set[str]:
    checksums = set(checksums)
    if not checksums:
        return set()

    pipeline = _get_assemble_redis_cluster().pipeline(transaction=False)
    ordered_checksums = list(checksums)
    for checksum in ordered_checksums:
        pipeline.get(name=get_debug_file_chunk_upload_intent_key(organization_id, checksum))
    return {
        checksum
        for checksum, intent in zip(ordered_checksums, pipeline.execute(), strict=True)
        if intent is not None
    }


def delete_debug_file_chunk_upload_intents(organization_id: int, checksums: Iterable[str]) -> None:
    checksums = set(checksums)
    if not checksums:
        return

    pipeline = _get_assemble_redis_cluster().pipeline(transaction=False)
    for checksum in checksums:
        pipeline.delete(get_debug_file_chunk_upload_intent_key(organization_id, checksum))
    pipeline.execute()


def _has_valid_chunk_expiry(time_expires: datetime | None, now: datetime) -> bool:
    return (
        time_expires is not None
        and timezone.is_aware(time_expires)
        and time_expires >= now + DEBUG_FILE_CHUNK_EXPIRY_SAFETY_WINDOW
    )


def find_missing_objectstore_chunks(organization_id: int, chunks: Iterable[str]) -> list[str]:
    """Returns Objectstore chunks that are absent or too close to expiry for assembly."""
    chunks = set(chunks)
    with start_span(
        op="find_missing_objectstore_chunks", name="find_missing_objectstore_chunks"
    ) as span:
        set_span_tag(span, "organization_id", organization_id)
        set_span_data(span, "chunks_size", len(chunks))

        if not chunks:
            return []

        session = get_debug_file_chunks_session(organization_id)
        now = timezone.now()
        missing_chunks = []
        # TODO: Replace this with Objectstore batch HEAD once client and server support it.
        for chunk in chunks:
            metadata = session.head(debug_file_chunk_key(chunk))
            if metadata is None or not _has_valid_chunk_expiry(metadata.time_expires, now):
                missing_chunks.append(chunk)

        set_debug_file_chunk_upload_intents(organization_id, missing_chunks)
        return missing_chunks


def find_missing_fileblob_chunks(organization_id: int, chunks: Set[str]) -> list[str]:
    """Returns a list of chunks which are missing for an org."""
    with start_span(op="find_missing_chunks", name="find_missing_chunks") as span:
        set_span_tag(span, "organization_id", organization_id)
        set_span_data(span, "chunks_size", len(chunks))

        if not chunks:
            return []

        with start_span(
            op="find_missing_chunks.fetch_owned_file_blobs",
            name="find_missing_chunks.fetch_owned_file_blobs",
        ):
            owned_file_blobs = FileBlob.objects.filter(
                checksum__in=chunks, fileblobowner__organization_id=organization_id
            ).values_list(
                "id",
                "checksum",
                "timestamp",
                flat=False,
            )

        # We compute the chunks that we know are owned and the ones that are not owned, but we still want to check.
        owned_file_chunks = {checksum for _, checksum, _ in owned_file_blobs}
        unowned_file_chunks = chunks - owned_file_chunks

        with start_span(
            op="find_missing_chunks.fetch_unowned_file_blobs",
            name="find_missing_chunks.fetch_unowned_file_blobs",
        ):
            unowned_file_blobs = FileBlob.objects.filter(
                checksum__in=unowned_file_chunks,
            ).values_list(
                "id",
                "checksum",
                "timestamp",
                flat=False,
            )

        now = timezone.now()
        oldest_timestamp = now - timedelta(hours=12)

        # For each file blob we compute whether we should renew it and whether it has already an organization bound to it.
        file_blobs_to_renew = set()
        for id, checksum, timestamp in list(owned_file_blobs) + list(unowned_file_blobs):
            if timestamp <= oldest_timestamp:
                file_blobs_to_renew.add(id)

        if file_blobs_to_renew:
            with start_span(
                op="find_missing_chunks_new.update_timestamp",
                name="find_missing_chunks_new.update_timestamp",
            ):
                # We update the timestamp of the file blobs that need renewal.
                FileBlob.objects.filter(id__in=file_blobs_to_renew).update(timestamp=now)

        # We return all the file chunks that are not bound to the supply organization.
        return list(unowned_file_chunks)
