from __future__ import annotations

from collections.abc import Generator
from typing import TYPE_CHECKING

import zstandard

from sentry.objectstore import get_attachments_session
from sentry.options.rollout import in_random_rollout
from sentry.utils import metrics
from sentry.utils.json import prune_empty_keys

if TYPE_CHECKING:
    from sentry.models.project import Project

ATTACHMENT_UNCHUNKED_DATA_KEY = "{key}:a:{id}"
ATTACHMENT_DATA_CHUNK_KEY = "{key}:a:{id}:{chunk_index}"

UNINITIALIZED_DATA = object()


class MissingAttachmentChunks(Exception):
    pass


class CachedAttachment:
    def __init__(
        self,
        key=None,
        id=None,
        name=None,
        content_type=None,
        type=None,
        chunks=None,
        data=UNINITIALIZED_DATA,
        stored_id: str | None = None,
        cache=None,
        rate_limited=None,
        size=None,
        **kwargs,
    ):
        self.key = key
        self.id = id

        self.name = name
        self.content_type = content_type
        self.type = type or "event.attachment"
        assert isinstance(self.type, str), self.type
        self.rate_limited = rate_limited

        if size is not None:
            self.size = size
        elif data not in (None, UNINITIALIZED_DATA):
            self.size = len(data)
        else:
            self.size = 0

        self.chunks = chunks
        self._data = data
        self.stored_id = stored_id
        self._cache = cache
        self._has_initial_data = data is not UNINITIALIZED_DATA

    @classmethod
    def from_upload(cls, file, **kwargs):
        return CachedAttachment(
            name=file.name, content_type=file.content_type, data=file.read(), **kwargs
        )

    def load_data(self, project: Project | None = None) -> bytes:
        if self.stored_id:
            assert project
            session = get_attachments_session(project.organization_id, project.id)
            return session.get(self.stored_id).payload.read()

        if self._data is UNINITIALIZED_DATA and self._cache is not None:
            self._data = self._cache.get_data(self)

        assert self._data is not UNINITIALIZED_DATA
        return self._data

    def delete(self):
        for key in self.chunk_keys:
            self._cache.inner.delete(key)

    @property
    def chunk_keys(self) -> Generator[str]:
        assert self.key is not None
        assert self.id is not None

        if self.stored_id or self._has_initial_data:
            return

        if self.chunks is None:
            yield ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=self.key, id=self.id)
            return

        for chunk_index in range(self.chunks):
            yield ATTACHMENT_DATA_CHUNK_KEY.format(
                key=self.key, id=self.id, chunk_index=chunk_index
            )

    def meta(self) -> dict:
        return prune_empty_keys(
            {
                "key": self.key,
                "id": self.id,
                "name": self.name,
                "rate_limited": self.rate_limited,
                "content_type": self.content_type,
                "type": self.type,
                "size": self.size or None,  # None for backwards compatibility
                "chunks": self.chunks,
                "stored_id": self.stored_id,
            }
        )


class BaseAttachmentCache:
    def __init__(self, inner):
        self.inner = inner

    def set(
        self,
        key: str,
        attachments: list[CachedAttachment],
        timeout=None,
        project: Project | None = None,
    ) -> list[dict]:
        for id, attachment in enumerate(attachments):
            # TODO(markus): We need to get away from sequential IDs, they
            # are risking collision when using Relay.
            if attachment.id is None:
                attachment.id = id
            if attachment.key is None:
                attachment.key = key

            # the attachment is stored, but has updated data, so we need to overwrite:
            if attachment.stored_id is not None and attachment._data is not UNINITIALIZED_DATA:
                assert project
                session = get_attachments_session(project.organization_id, project.id)
                session.put(attachment._data, key=attachment.stored_id)

            # the attachment is stored either in objectstore or in the attachment cache already
            if attachment.chunks is not None or attachment.stored_id is not None:
                continue

            # otherwise, store it in objectstore or the attachments cache:
            if in_random_rollout("objectstore.enable_for.cached_attachments"):
                assert project
                session = get_attachments_session(project.organization_id, project.id)
                attachment.stored_id = session.put(attachment.load_data(project))
                continue

            metrics_tags = {"type": attachment.type}
            self.set_unchunked_data(
                key=key,
                id=attachment.id,
                data=attachment.load_data(project),
                timeout=timeout,
                metrics_tags=metrics_tags,
            )

        meta = []
        for attachment in attachments:
            attachment._cache = self
            meta.append(attachment.meta())

        return meta

    def set_chunk(self, key: str, id: int, chunk_index: int, chunk_data: bytes, timeout=None):
        key = ATTACHMENT_DATA_CHUNK_KEY.format(key=key, id=id, chunk_index=chunk_index)
        compressed = zstandard.compress(chunk_data)
        self.inner.set(key, compressed, timeout, raw=True)

    def set_unchunked_data(self, key: str, id: int, data: bytes, timeout=None, metrics_tags=None):
        key = ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=key, id=id)
        compressed = zstandard.compress(data)
        metrics.distribution("attachments.blob-size.raw", len(data), tags=metrics_tags, unit="byte")
        metrics.distribution(
            "attachments.blob-size.compressed", len(compressed), tags=metrics_tags, unit="byte"
        )
        metrics.incr("attachments.received", tags=metrics_tags, skip_internal=False)
        self.inner.set(key, compressed, timeout, raw=True)

    def get_from_chunks(self, key: str, **attachment) -> CachedAttachment:
        return CachedAttachment(key=key, cache=self, **attachment)

    def get_data(self, attachment: CachedAttachment) -> bytes:
        data = bytearray()

        for key in attachment.chunk_keys:
            raw_data = self.inner.get(key, raw=True)
            if raw_data is None:
                raise MissingAttachmentChunks()
            decompressed = zstandard.decompress(raw_data)
            data.extend(decompressed)

        return bytes(data)
