from __future__ import absolute_import

import copy

from sentry.attachments.base import CachedAttachment, BaseAttachmentCache


class InMemoryCache(object):
    """
    In-memory mock cache that roughly works like Django cache. Extended with
    internal assertions to ensure correct use of `raw`.
    """

    def __init__(self):
        self.data = {}
        #: Used to check for consistent usage of `raw` param
        self.raw_map = {}

    def get(self, key, raw=False):
        assert key not in self.raw_map or raw == self.raw_map[key]
        return copy.deepcopy(self.data.get(key))

    def set(self, key, value, timeout=None, raw=False):
        # Attachment chunks MUST be bytestrings. Josh please don't change this
        # to unicode.
        assert isinstance(value, bytes) or not raw
        assert key not in self.raw_map or raw == self.raw_map[key]
        self.data[key] = value

    def delete(self, key):
        del self.data[key]


def test_basic_chunked():
    data = InMemoryCache()
    cache = BaseAttachmentCache(data)

    cache.set_chunk("c:foo", 123, 0, b"Hello World! ")
    cache.set_chunk("c:foo", 123, 1, b"")
    cache.set_chunk("c:foo", 123, 2, b"Bye.")

    att = CachedAttachment(key="c:foo", id=123, name="lol.txt", content_type="text/plain", chunks=3)
    cache.set("c:foo", [att])

    (att2,) = cache.get("c:foo")
    assert att2.key == att.key == "c:foo"
    assert att2.id == att.id == 123
    assert att2.data == att.data == b"Hello World! Bye."

    cache.delete("c:foo")
    assert not list(cache.get("c:foo"))


def test_basic_unchunked():
    data = InMemoryCache()
    cache = BaseAttachmentCache(data)

    att = CachedAttachment(name="lol.txt", content_type="text/plain", data=b"Hello World! Bye.")
    cache.set("c:foo", [att])

    (att2,) = cache.get("c:foo")
    assert att2.key == att.key == "c:foo"
    assert att2.id == att.id == 0
    assert att2.data == att.data == b"Hello World! Bye."

    cache.delete("c:foo")
    assert not list(cache.get("c:foo"))
