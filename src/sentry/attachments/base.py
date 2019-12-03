from __future__ import absolute_import

import zlib

from sentry.utils import metrics
from sentry.utils.json import prune_empty_keys


ATTACHMENT_META_KEY = u"{key}:a"
ATTACHMENT_UNCHUNKED_DATA_KEY = u"{key}:a:{id}"
ATTACHMENT_DATA_CHUNK_KEY = u"{key}:a:{id}:{chunk_index}"


class CachedAttachment(object):
    def __init__(
        self,
        key=None,
        id=None,
        name=None,
        content_type=None,
        type=None,
        data=None,
        chunks=None,
        cache=None,
        meta_only=False,
    ):
        if data is None and cache is None and not meta_only:
            raise AttributeError("Missing attachment data")

        self.key = key
        self.id = id

        self.name = name
        self.content_type = content_type
        self.type = type or "event.attachment"

        self._data = data
        self._chunks = chunks
        self._cache = cache

    @classmethod
    def from_upload(cls, file, **kwargs):
        return CachedAttachment(
            name=file.name, content_type=file.content_type, data=file.read(), **kwargs
        )

    @property
    def data(self):
        if self._data is None and self._cache is not None:
            assert self.id is not None

            if self._chunks is None:
                self._data = self._cache.get_unchunked_data(key=self.key, id=self.id)
            else:
                data = []
                for chunk_index in range(self._chunks):
                    data.append(self._cache.get_chunk(key=self.key, id=self.id))

                self._data = b"".join(data)

        return self._data

    def meta(self):
        return prune_empty_keys(
            {
                "id": self.id,
                "name": self.name,
                "content_type": self.content_type,
                "type": self.type,
                "chunks": self._chunks,
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

    def get(self, key):
        result = self.inner.get(ATTACHMENT_META_KEY.format(key=key), raw=False)
        if result is not None:
            rv = []
            for id, attachment in enumerate(result):
                attachment.setdefault("id", id)
                rv.append(CachedAttachment(cache=self, key=key, **attachment))

            return rv

        return result

    def get_chunk(self, key, id, chunk_index):
        key = ATTACHMENT_DATA_CHUNK_KEY.format(key=key, id=id)
        return zlib.decompress(self.inner.get(key, raw=True))

    def get_unchunked_data(self, key, id):
        key = ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=key, id=id)
        result = self.inner.get(key, raw=True)
        if result is None:
            return result
        return zlib.decompress(result)

    def delete(self, key):
        attachments = self.inner.get(ATTACHMENT_META_KEY.format(key=key), raw=False)
        if attachments is None:
            return

        for id, attachment in enumerate(attachments):
            chunks = attachment.get("chunks")
            if chunks is None:
                self.inner.delete(ATTACHMENT_UNCHUNKED_DATA_KEY.format(key=key, id=id))
            else:
                for chunk_index in range(chunks):
                    self.inner.delete(
                        ATTACHMENT_DATA_CHUNK_KEY.format(key=key, id=id, chunk_index=chunk_index)
                    )

        self.inner.delete(key)
