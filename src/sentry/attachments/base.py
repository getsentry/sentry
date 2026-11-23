from __future__ import annotations

from collections.abc import Generator
from datetime import timedelta
from typing import TYPE_CHECKING, Protocol, TypedDict, Unpack, cast

import zstandard
from django.core.files.uploadedfile import UploadedFile
from objectstore_client import TimeToLive

from sentry.objectstore import UsecaseId, default_attachment_retention, get_session
from sentry.utils import metrics
from sentry.utils.json import prune_empty_keys

if TYPE_CHECKING:
    from sentry.models.project import Project

ATTACHMENT_UNCHUNKED_DATA_KEY = "{key}:a:{id}"
ATTACHMENT_DATA_CHUNK_KEY = "{key}:a:{id}:{chunk_index}"

UNINITIALIZED_DATA = object()


class MissingAttachmentChunks(Exception):
    pass


class _AttachmentCacheStorage(Protocol):
    def set(self, key: str, value: bytes, timeout: int, *, raw: bool = ...) -> None: ...

    def get(self, key: str, *, raw: bool = ...) -> object | None: ...

    def delete(self, key: str) -> None: ...


class _AttachmentMetadata(TypedDict, total=False):
    id: int | None
    name: str | None
    content_type: str | None
    type: str | None
    chunks: int | None
    data: object
    stored_id: str | None
    rate_limited: bool | None
    size: int | None
    retention_days: int | None


class _AttachmentUploadOptions(TypedDict, total=False):
    id: int | None
    type: str | None
    chunks: int | None
    stored_id: str | None
    rate_limited: bool | None
    size: int | None
    retention_days: int | None


class CachedAttachment:
    def __init__(
        self,
        key: str | None = None,
        id: int | None = None,
        name: str | None = None,
        content_type: str | None = None,
        type: str | None = None,
        chunks: int | None = None,
        data: object = UNINITIALIZED_DATA,
        stored_id: str | None = None,
        cache: BaseAttachmentCache | None = None,
        rate_limited: bool | None = None,
        size: int | None = None,
        retention_days: int | None = None,
        **kwargs: object,
    ) -> None:
        self.key = key
        self.id = id

        self.name = name
        self.content_type = content_type
        self.type = type or "event.attachment"
        assert isinstance(self.type, str), self.type
        self.rate_limited = rate_limited
        self.retention_days = retention_days or default_attachment_retention()

        if size is not None:
            self.size = size
        elif data not in (None, UNINITIALIZED_DATA):
            self.size = len(cast(bytes, data))
        else:
            self.size = 0

        self.chunks = chunks
        self._data = data
        self.stored_id = stored_id
        self._cache = cache
        self._has_initial_data = data is not UNINITIALIZED_DATA

    @classmethod
    def from_upload(
        cls, file: UploadedFile, **kwargs: Unpack[_AttachmentUploadOptions]
    ) -> CachedAttachment:
        return CachedAttachment(
            name=file.name, content_type=file.content_type, data=file.read(), **kwargs
        )

    def load_data(self, project: Project | None = None) -> bytes:
        if self.stored_id:
            assert project
            session = get_session(UsecaseId.ATTACHMENTS, project)
            response = session.get(self.stored_id)
            if response is None:
                raise FileNotFoundError("Attachment does not exist in objectstore")
            return response.payload.read()

        if self._data is UNINITIALIZED_DATA and self._cache is not None:
            self._data = self._cache.get_data(self)

        assert self._data is not UNINITIALIZED_DATA
        return cast(bytes, self._data)

    def delete(self) -> None:
        for key in self.chunk_keys:
            cast(BaseAttachmentCache, self._cache).inner.delete(key)

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

    def meta(self) -> _AttachmentMetadata:
        return cast(
            _AttachmentMetadata,
            prune_empty_keys(
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
                    "retention_days": self.retention_days,
                }
            ),
        )


class BaseAttachmentCache:
    def __init__(self, inner: _AttachmentCacheStorage) -> None:
        self.inner = inner

    def set(
        self,
        key: str,
        attachments: list[CachedAttachment],
        timeout: int,
        project: Project | None = None,
    ) -> list[_AttachmentMetadata]:
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
                session = get_session(UsecaseId.ATTACHMENTS, project)
                # A keyed `put` replaces the object wholesale, so metadata that is not
                # sent here is lost rather than preserved from the previous write.
                session.put(
                    contents=cast(bytes, attachment._data),
                    key=attachment.stored_id,
                    content_type=attachment.content_type,
                    filename=attachment.name,
                    expiration_policy=TimeToLive(timedelta(days=attachment.retention_days)),
                )

            # the attachment is stored either in objectstore or in the attachment cache already
            if attachment.chunks is not None or attachment.stored_id is not None:
                continue

            # otherwise, store it in the attachment cache:
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

    def set_chunk(
        self, key: str, id: int, chunk_index: int, chunk_data: bytes, timeout: int
    ) -> None:
        key = ATTACHMENT_DATA_CHUNK_KEY.format(key=key, id=id, chunk_index=chunk_index)
        compressed = zstandard.compress(chunk_data)
        self.inner.set(key, compressed, timeout, raw=True)

    def set_unchunked_data(
        self,
        key: str,
        id: int,
        data: bytes,
        timeout: int,
        metrics_tags: dict[str, str] | None = None,
    ) -> None:
        key = ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=key, id=id)
        compressed = zstandard.compress(data)
        metrics.distribution("attachments.blob-size.raw", len(data), tags=metrics_tags, unit="byte")
        metrics.distribution(
            "attachments.blob-size.compressed", len(compressed), tags=metrics_tags, unit="byte"
        )
        metrics.incr("attachments.received", tags=metrics_tags, skip_internal=False)
        self.inner.set(key, compressed, timeout, raw=True)

    def get_from_chunks(
        self, key: str, **attachment: Unpack[_AttachmentMetadata]
    ) -> CachedAttachment:
        return CachedAttachment(key=key, cache=self, **attachment)

    def get_data(self, attachment: CachedAttachment) -> bytes:
        data = bytearray()

        for key in attachment.chunk_keys:
            raw_data = self.inner.get(key, raw=True)
            if raw_data is None:
                raise MissingAttachmentChunks()
            decompressed = zstandard.decompress(cast(bytes, raw_data))
            data.extend(decompressed)

        return bytes(data)
