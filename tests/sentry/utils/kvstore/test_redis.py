from datetime import timedelta

import pytest
from redis import Redis

from sentry.exceptions import MissingTTL
from sentry.utils.kvstore.redis import RedisKVStorage


def test_set_without_a_ttl_is_rejected() -> None:
    store = RedisKVStorage[bytes](Redis(db=6))

    with pytest.raises(MissingTTL):
        store.set("key", b"value")

    with pytest.raises(MissingTTL):
        store.set("key", b"value", ttl=timedelta(0))

    assert store.get("key") is None
