import threading

import pytest

from sentry.utils.local_cache import LRUCache, SizedKeyCache, ThreadSafeCache


class TestLRUCache:
    def test_set_and_get(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        assert cache["a"] == 1

    def test_contains(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        assert "a" in cache
        assert "b" not in cache

    def test_len(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        assert len(cache) == 0
        cache["a"] = 1
        cache["b"] = 2
        assert len(cache) == 2

    def test_delitem(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        del cache["a"]
        assert "a" not in cache

    def test_delitem_missing_raises(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        with pytest.raises(KeyError):
            del cache["missing"]

    def test_getitem_missing_raises(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        with pytest.raises(KeyError):
            cache["missing"]

    def test_get_returns_none_when_missing(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        assert cache.get("missing") is None

    def test_get_returns_value_when_present(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        assert cache.get("a") == 1

    def test_pop_returns_value_and_removes(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        assert cache.pop("a") == 1
        assert "a" not in cache

    def test_pop_returns_none_when_missing(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        assert cache.pop("missing") is None

    def test_eviction_when_over_maxlen(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        cache["c"] = 3
        assert "a" not in cache
        assert "b" in cache
        assert "c" in cache
        assert len(cache) == 2

    def test_getitem_refreshes_recency(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        # Access "a" so "b" becomes least-recently-used.
        assert cache["a"] == 1
        cache["c"] = 3
        assert "a" in cache
        assert "b" not in cache
        assert "c" in cache

    def test_get_refreshes_recency(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        # get() should also count as a use and refresh recency.
        assert cache.get("a") == 1
        cache["c"] = 3
        assert "a" in cache
        assert "b" not in cache

    def test_setitem_overwrite_refreshes_recency(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        # Re-set "a" so "b" becomes least-recently-used.
        cache["a"] = 10
        cache["c"] = 3
        assert cache["a"] == 10
        assert "b" not in cache
        assert "c" in cache

    def test_keys_values_items(self) -> None:
        cache: LRUCache[str, int] = LRUCache(maxlen=3)
        cache["a"] = 1
        cache["b"] = 2
        assert sorted(cache.keys()) == ["a", "b"]
        assert sorted(cache.values()) == [1, 2]
        assert sorted(cache.items()) == [("a", 1), ("b", 2)]


class TestThreadSafeCache:
    def test_delegates_set_and_get(self) -> None:
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=2))
        cache["a"] = 1
        assert cache["a"] == 1
        assert cache.get("a") == 1
        assert cache.get("missing") is None

    def test_contains_and_len(self) -> None:
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=2))
        cache["a"] = 1
        assert "a" in cache
        assert "b" not in cache
        assert len(cache) == 1

    def test_delitem(self) -> None:
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=2))
        cache["a"] = 1
        del cache["a"]
        assert "a" not in cache

    def test_pop(self) -> None:
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=2))
        cache["a"] = 1
        assert cache.pop("a") == 1
        assert cache.pop("a") is None

    def test_eviction_delegates_to_wrapped_cache(self) -> None:
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=2))
        cache["a"] = 1
        cache["b"] = 2
        cache["c"] = 3
        assert len(cache) == 2
        assert "a" not in cache

    def test_keys_values_items_return_snapshot(self) -> None:
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=3))
        cache["a"] = 1
        cache["b"] = 2
        assert sorted(cache.keys()) == ["a", "b"]
        assert sorted(cache.values()) == [1, 2]
        assert sorted(cache.items()) == [("a", 1), ("b", 2)]

    def test_iteration_does_not_hold_lock(self) -> None:
        # keys()/values()/items() snapshot under the lock and yield outside it,
        # so consuming the iterator must not block concurrent writes.
        cache: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=10))
        cache["a"] = 1
        cache["b"] = 2

        keys_iter = cache.keys()
        next(keys_iter)
        # The lock must be free here even though the iterator is only partially
        # consumed; otherwise this set would deadlock.
        cache["c"] = 3
        assert "c" in cache

    def test_concurrent_writes_do_not_corrupt(self) -> None:
        cache: ThreadSafeCache[int, int] = ThreadSafeCache(LRUCache(maxlen=100_000))
        n = 1_000
        num_threads = 8

        def worker(offset: int) -> None:
            for i in range(n):
                key = offset * n + i
                cache[key] = key

        threads = [threading.Thread(target=worker, args=(offset,)) for offset in range(num_threads)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert len(cache) == n * num_threads
        for offset in range(num_threads):
            for i in (0, n // 2, n - 1):
                key = offset * n + i
                assert cache[key] == key

    def test_concurrent_iteration_during_writes(self) -> None:
        # Snapshotting under the lock means a reader never observes a dict that
        # mutates mid-iteration (which would raise RuntimeError).
        cache: ThreadSafeCache[int, int] = ThreadSafeCache(LRUCache(maxlen=200))
        for i in range(200):
            cache[i] = i

        errors: list[Exception] = []
        stop = threading.Event()

        def writer() -> None:
            i = 200
            while not stop.is_set():
                cache[i] = i
                i += 1

        def reader() -> None:
            try:
                for _ in range(50):
                    assert isinstance(list(cache.items()), list)
                    assert isinstance(list(cache.keys()), list)
                    assert isinstance(list(cache.values()), list)
            except Exception as e:  # noqa: BLE001 - surface any threading error to the assertion
                errors.append(e)

        w = threading.Thread(target=writer)
        r = threading.Thread(target=reader)
        w.start()
        r.start()
        r.join()
        stop.set()
        w.join()

        assert errors == []


class TestSizedKeyCache:
    def test_set_and_get(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 123
        assert cache["key"] == 123

    def test_contains(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 123
        assert "key" in cache
        assert "other" not in cache

    def test_len(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        assert len(cache) == 0
        cache["key"] = 1
        assert len(cache) == 1

    def test_delitem(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 1
        del cache["key"]
        assert "key" not in cache

    def test_getitem_missing_raises(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        with pytest.raises(KeyError):
            cache["missing"]

    def test_get_returns_none_when_missing(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        assert cache.get("missing") is None

    def test_get_returns_value_when_present(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 456
        assert cache.get("key") == 456

    def test_pop(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 1
        assert cache.pop("key") == 1
        assert cache.pop("key") is None

    def test_eviction_respects_maxlen(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=2))
        cache["a"] = 1
        cache["b"] = 2
        cache["c"] = 3
        assert len(cache) == 2
        assert "a" not in cache
        assert "c" in cache

    def test_keys_are_hashed_integers(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 1
        keys = list(cache.keys())
        assert keys == [cache._hash_key("key")]
        assert all(isinstance(k, int) for k in keys)

    def test_values_and_items(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        cache["key"] = 99
        assert list(cache.values()) == [99]
        assert list(cache.items()) == [(cache._hash_key("key"), 99)]

    def test_hash_key_is_deterministic(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        assert cache._hash_key("key") == cache._hash_key("key")

    def test_hash_key_distinct_for_different_keys(self) -> None:
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        assert cache._hash_key("a") != cache._hash_key("b")

    def test_hash_key_size_is_bounded(self) -> None:
        # digest_size=15 bytes -> the integer must fit in 15 bytes (120 bits).
        cache: SizedKeyCache[int] = SizedKeyCache(LRUCache(maxlen=10))
        assert cache._hash_key("some-arbitrary-key").bit_length() <= 120

    def test_wraps_thread_safe_cache(self) -> None:
        # Mirrors the production composition in the spans consumer.
        cache: SizedKeyCache[int] = SizedKeyCache(ThreadSafeCache(LRUCache(maxlen=10)))
        cache["key"] = 7
        assert cache["key"] == 7
        assert cache.get("key") == 7
