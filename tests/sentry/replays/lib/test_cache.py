import pytest

from sentry.replays.lib.cache import AutoCache, BoundedFifoCache, BoundedLRUCache, TimeLimitedCache


def test_bounded_fifo_cache():
    cache = BoundedFifoCache(maxlen=2)

    with pytest.raises(KeyError):
        cache[0]

    cache[0] = 0
    assert cache[0] == 0

    cache[1] = 1
    cache[2] = 2
    assert 0 not in cache
    assert 1 in cache
    assert 2 in cache

    cache[1]  # Reading keys does not affect order.
    cache[3] = 3
    assert 1 not in cache
    assert 2 in cache
    assert 3 in cache

    cache[1] = 1
    assert 1 in cache
    assert 2 not in cache
    assert 3 in cache


def test_bounded_lru_cache():
    cache = BoundedLRUCache(maxlen=2)

    with pytest.raises(KeyError):
        cache[0]

    cache[0] = 0
    assert cache[0] == 0

    cache[1] = 1
    cache[2] = 2
    assert 0 not in cache
    assert 1 in cache
    assert 2 in cache

    cache[1]  # Reading keys affects order.
    cache[3] = 3
    assert 1 in cache
    assert 2 not in cache
    assert 3 in cache

    cache[2] = 2
    assert 1 not in cache
    assert 2 in cache
    assert 3 in cache


def test_time_limited_cache():
    cache = TimeLimitedCache(BoundedFifoCache(maxlen=3), maxage=0)

    cache["hello"] = "world"
    with pytest.raises(KeyError):
        cache["hello"]

    cache = TimeLimitedCache(BoundedFifoCache(maxlen=3), maxage=1)
    cache[0] = 0
    cache[1] = 1
    cache[2] = 2
    cache[3] = 3
    assert 0 not in cache
    assert 1 in cache
    assert 2 in cache
    assert 3 in cache


def test_auto_cache():
    cache = AutoCache(fn=lambda n: n, cache=BoundedFifoCache(maxlen=2))
    assert cache[0] == 0
    assert cache[1] == 1
    assert cache[2] == 2
    assert 0 not in cache
    assert 1 in cache
    assert 2 in cache

    # Assert we can write to the auto-cache if we retrieved the value out of band.
    cache[3] = 4
    assert cache[3] == 4
