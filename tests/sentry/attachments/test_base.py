import copy

from sentry.attachments.base import BaseAttachmentCache, CachedAttachment
from sentry.testutils.pytest.fixtures import django_db_all


class InMemoryCache:
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


def test_meta_basic() -> None:
    att = CachedAttachment(key="c:foo", id=123, name="lol.txt", content_type="text/plain", chunks=3)

    # Regression test to verify that we do not add additional attributes. Note
    # that ``rate_limited`` is missing from this dict.
    assert att.meta() == {
        "key": "c:foo",
        "id": 123,
        "chunks": 3,
        "content_type": "text/plain",
        "name": "lol.txt",
        "type": "event.attachment",
    }


def test_meta_rate_limited() -> None:
    att = CachedAttachment(
        key="c:foo", id=123, name="lol.txt", content_type="text/plain", chunks=3, rate_limited=True
    )

    assert att.meta() == {
        "key": "c:foo",
        "id": 123,
        "chunks": 3,
        "content_type": "text/plain",
        "name": "lol.txt",
        "rate_limited": True,
        "type": "event.attachment",
    }


def test_basic_chunked() -> None:
    data = InMemoryCache()
    cache = BaseAttachmentCache(data)

    cache.set_chunk("c:foo", 123, 0, b"Hello World! ")
    cache.set_chunk("c:foo", 123, 1, b"")
    cache.set_chunk("c:foo", 123, 2, b"Bye.")

    att = CachedAttachment(key="c:foo", id=123, name="lol.txt", content_type="text/plain", chunks=3)
    (meta,) = cache.set("c:foo", [att])
    att2 = CachedAttachment(cache=cache, **meta)

    assert att2.key == att.key == "c:foo"
    assert att2.id == att.id == 123
    assert att2.load_data() == att.load_data() == b"Hello World! Bye."
    assert att2.rate_limited is None


@django_db_all
def test_basic_unchunked() -> None:
    data = InMemoryCache()
    cache = BaseAttachmentCache(data)

    att = CachedAttachment(name="lol.txt", content_type="text/plain", data=b"Hello World! Bye.")
    (meta,) = cache.set("c:foo", [att])
    att2 = CachedAttachment(cache=cache, **meta)

    assert att2.key == att.key == "c:foo"
    assert att2.id == att.id == 0
    assert att2.load_data() == att.load_data() == b"Hello World! Bye."
    assert att2.rate_limited is None


@django_db_all
def test_zstd_chunks() -> None:
    data = InMemoryCache()
    cache = BaseAttachmentCache(data)

    cache.set_chunk("mixed_chunks", 123, 0, b"Hello World! ")
    cache.set_chunk("mixed_chunks", 123, 1, b"Just visiting. ")
    cache.set_chunk("mixed_chunks", 123, 2, b"Bye.")

    mixed_chunks = cache.get_from_chunks(key="mixed_chunks", id=123, chunks=3)
    assert mixed_chunks.load_data() == b"Hello World! Just visiting. Bye."

    att = CachedAttachment(key="not_chunked", id=456, data=b"Hello World! Bye.")
    (meta,) = cache.set("not_chunked", [att])
    not_chunked = CachedAttachment(cache=cache, **meta)

    assert not_chunked.load_data() == b"Hello World! Bye."


@django_db_all
def test_basic_rate_limited() -> None:
    data = InMemoryCache()
    cache = BaseAttachmentCache(data)

    att = CachedAttachment(
        name="lol.txt", content_type="text/plain", data=b"Hello World! Bye.", rate_limited=True
    )
    (meta,) = cache.set("c:foo", [att])
    att2 = CachedAttachment(cache=cache, **meta)

    assert att2.key == att.key == "c:foo"
    assert att2.id == att.id == 0
    assert att2.load_data() == att.load_data() == b"Hello World! Bye."
    assert att2.rate_limited is True
