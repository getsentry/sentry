import pytest
import rb

from sentry import options
from sentry.cache.redis import RedisCache, RedisClusterCache, ValueTooLarge
from sentry.exceptions import MissingTTL
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.xdist import get_redis_db
from sentry.utils.redis import redis_clusters
from sentry.utils.warnings import DeprecatedSettingWarning

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


def _assert_roundtrip(backend: RedisCache) -> None:
    backend.set("foo", {"foo": "bar"}, timeout=50)
    assert backend.get("foo") == {"foo": "bar"}
    backend.set("k", b"\xa0\x12\xfe", timeout=50, raw=True)
    assert backend.get("k", raw=True) == b"\xa0\x12\xfe"
    backend.delete("foo")
    backend.delete("k")
    assert backend.get("foo") is None
    assert backend.get("k") is None


@pytest.mark.parametrize("cache_options", ({}, {"cluster": "default"}), ids=("implicit", "named"))
def test_redis_cache_uses_redis_clusters_for_single_host(cache_options) -> None:
    backend = RedisCache(**cache_options)
    assert backend._text_client is redis_clusters.get("default")
    assert backend._bytes_client is redis_clusters.get_binary("default")
    _assert_roundtrip(backend)


def test_redis_cache_falls_back_to_rb_for_multi_host_cluster() -> None:
    db = get_redis_db()
    clusters = {
        **options.get("redis.clusters"),
        "cache-multi-host": {"hosts": {0: {"db": db}, 1: {"db": db}}},
    }
    with override_options({"redis.clusters": clusters}):
        backend = RedisCache(cluster="cache-multi-host")
        assert isinstance(backend._text_client, rb.RoutingClient)
        assert backend._bytes_client is backend._text_client
        _assert_roundtrip(backend)


def test_redis_cache_falls_back_to_rb_for_inline_hosts() -> None:
    with pytest.warns(DeprecatedSettingWarning):
        backend = RedisCache(hosts={0: {"db": get_redis_db()}})
    assert isinstance(backend._text_client, rb.RoutingClient)
    _assert_roundtrip(backend)
