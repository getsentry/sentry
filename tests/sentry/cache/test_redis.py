import pytest

from sentry.cache.redis import RedisCache, RedisClusterCache, ValueTooLarge
from sentry.exceptions import MissingTTL

clients = pytest.mark.parametrize(
    "make_client",
    (
        pytest.param(RedisCache, id="RedisCache"),
        pytest.param(lambda: RedisClusterCache("default"), id="RedisClusterCache"),
    ),
)


@clients
def test_redis_cache_integration(make_client) -> None:
    backend = make_client()
    backend.set("foo", {"foo": "bar"}, timeout=50)

    result = backend.get("foo")
    assert result == {"foo": "bar"}

    backend.delete("foo")

    result = backend.get("foo")
    assert result is None

    with pytest.raises(ValueTooLarge):
        backend.set("foo", "x" * (RedisCache.max_size + 1), 50)


@clients
def test_set_without_a_timeout_is_rejected(make_client) -> None:
    backend = make_client()

    with pytest.raises(MissingTTL):
        backend.set("foo", {"foo": "bar"}, timeout=None)

    with pytest.raises(MissingTTL):
        backend.set("foo", {"foo": "bar"}, timeout=0)

    assert backend.get("foo") is None


@clients
def test_raw_preserves_bytes(make_client) -> None:
    backend = make_client()
    backend.set("k", b"\xa0\x12\xfe", timeout=50, raw=True)
    assert backend.get("k", raw=True) == b"\xa0\x12\xfe"
    backend.delete("k")
    assert backend.get("k") is None
