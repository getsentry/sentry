from __future__ import absolute_import

from six import string_types
import zlib

from sentry.utils import metrics
from sentry.utils.json import prune_empty_keys


ATTACHMENT_META_KEY = u"{key}:a"
ATTACHMENT_UNCHUNKED_DATA_KEY = u"{key}:a:{id}"
ATTACHMENT_DATA_CHUNK_KEY = u"{key}:a:{id}:{chunk_index}"

UNINITIALIZED_DATA = object()


class MissingAttachmentChunks(Exception):
    pass


class CachedAttachment(object):
    def __init__(
        self,
        key=None,
        id=None,
        name=None,
        content_type=None,
        type=None,
        data=UNINITIALIZED_DATA,
        chunks=None,
        cache=None,
        rate_limited=None,
        size=None,
        **kwargs
    ):
        self.key = key
        self.id = id

        self.name = name
        self.content_type = content_type
        self.type = type or "event.attachment"
        assert isinstance(self.type, string_types), self.type
        self.rate_limited = rate_limited

        if size is not None:
            self.size = size
        elif data not in (None, UNINITIALIZED_DATA):
            self.size = len(data)
        else:
            self.size = 0

        self._data = data
        self.chunks = chunks
        self._cache = cache

    @classmethod
    def from_upload(cls, file, **kwargs):
        return CachedAttachment(
            name=file.name, content_type=file.content_type, data=file.read(), **kwargs
        )

    @property
    def data(self):
        if self._data is UNINITIALIZED_DATA and self._cache is not None:
            self._data = self._cache.get_data(self)

        assert self._data is not UNINITIALIZED_DATA
        return self._data

    def delete(self):
        for key in self.chunk_keys:
            self._cache.inner.delete(key)

    @property
    def chunk_keys(self):
        assert self.key is not None
        assert self.id is not None

        if self.chunks is None:
            yield ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=self.key, id=self.id)
            return

        for chunk_index in range(self.chunks):
            yield ATTACHMENT_DATA_CHUNK_KEY.format(
                key=self.key, id=self.id, chunk_index=chunk_index
            )

    def meta(self):
        return prune_empty_keys(
            {
                "id": self.id,
                "name": self.name,
                "content_type": self.content_type,
                "type": self.type,
                "chunks": self.chunks,
                "size": self.size or None,  # None for backwards compatibility
                "rate_limited": self.rate_limited,
            }
        )


class BaseAttachmentCache(object):
    def __init__(self, inner):
        self.inner = inner

    def set(self, key, attachments, timeout=None):
        for id, attachment in enumerate(attachments):
            if attachment.chunks is not None:
                continue
            # TODO(markus): We need to get away from sequential IDs, they
            # are risking collision when using Relay.
            if attachment.id is None:
                attachment.id = id

            if attachment.key is None:
                attachment.key = key

            metrics_tags = {"type": attachment.type}
            self.set_unchunked_data(
                key=key,
                id=attachment.id,
                data=attachment.data,
                timeout=timeout,
                metrics_tags=metrics_tags,
            )

        meta = []

        for attachment in attachments:
            attachment._cache = self
            meta.append(attachment.meta())

        self.inner.set(ATTACHMENT_META_KEY.format(key=key), meta, timeout, raw=False)

    def set_chunk(self, key, id, chunk_index, chunk_data, timeout=None):
        key = ATTACHMENT_DATA_CHUNK_KEY.format(key=key, id=id, chunk_index=chunk_index)
        self.inner.set(key, zlib.compress(chunk_data), timeout, raw=True)

    def set_unchunked_data(self, key, id, data, timeout=None, metrics_tags=None):
        key = ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=key, id=id)
        compressed = zlib.compress(data)
        metrics.timing("attachments.blob-size.raw", len(data), tags=metrics_tags)
        metrics.timing("attachments.blob-size.compressed", len(compressed), tags=metrics_tags)
        metrics.incr("attachments.received", tags=metrics_tags, skip_internal=False)
        self.inner.set(key, compressed, timeout, raw=True)

    def get_from_chunks(self, key, **attachment):
        return CachedAttachment(key=key, cache=self, **attachment)

    def get(self, key):
        result = self.inner.get(ATTACHMENT_META_KEY.format(key=key), raw=False)

        for id, attachment in enumerate(result or ()):
            attachment.setdefault("id", id)
            attachment.setdefault("key", key)
            yield CachedAttachment(cache=self, **attachment)

    def get_data(self, attachment):
        data = []

        for key in attachment.chunk_keys:
            raw_data = self.inner.get(key, raw=True)
            if raw_data is None:
                raise MissingAttachmentChunks()
            data.append(zlib.decompress(raw_data))

        return b"".join(data)

    def delete(self, key):
        for attachment in self.get(key):
            attachment.delete()

        self.inner.delete(ATTACHMENT_META_KEY.format(key=key))
