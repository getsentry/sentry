from redis import Redis

from sentry.cache.redis import CommonRedisCache
from sentry.utils.codecs import BytesCodec, JSONCodec
from sentry.utils.kvstore.cache import CacheKeyWrapper, CacheKVStorage
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper
from sentry.utils.kvstore.redis import RedisKVStorage


def test_redis_cache_compat() -> None:
    redis = Redis(db=6)
    version = 5
    prefix = "test"

    cache_backend = CacheKVStorage(CommonRedisCache(redis, version=version, prefix=prefix))
    redis_backend = KVStorageCodecWrapper(
        CacheKeyWrapper(RedisKVStorage(redis), version=version, prefix=prefix),
        JSONCodec() | BytesCodec(),
    )

    key = "key"

    value = [1, 2, 3]
    cache_backend.set(key, value)
    assert cache_backend.get(key) == value
    assert redis_backend.get(key) == value

    value = [4, 5, 6]
    redis_backend.set("key", value)
    assert cache_backend.get(key) == value
    assert redis_backend.get(key) == value

    cache_backend.delete("key")
    assert cache_backend.get("key") is None
    assert redis_backend.get("key") is None
