from typing import Iterator

import pytest

from sentry.utils.codecs import BytesCodec, JSONCodec
from sentry.utils.kvstore.abstract import KVStorage
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper
from sentry.utils.kvstore.memory import MemoryKVStorage


@pytest.fixture
def store() -> Iterator[KVStorage[str, bytes]]:
    store: KVStorage[str, bytes] = MemoryKVStorage()
    yield store
    store.destroy()


def test_encoding_wrapper(store: KVStorage[str, bytes]) -> None:
    wrapper = KVStorageCodecWrapper(store, JSONCodec() | BytesCodec())

    wrapper.set("key", [1, 2, 3])
    assert store.get("key") == b"[1,2,3]"

    assert wrapper.get("key") == [1, 2, 3]
    assert [*wrapper.get_many(["key", "missing"])] == [("key", [1, 2, 3])]
