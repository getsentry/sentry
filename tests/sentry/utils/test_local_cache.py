import pytest

from sentry.utils.local_cache import BoundedLRUCache, DebouncedDedeuplicatedCache


class TestBoundedLRUCache:
    def test_set_and_get(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        cache["a"] = 1
        assert cache["a"] == 1

    def test_contains(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        cache["a"] = 1
        assert "a" in cache
        assert "b" not in cache

    def test_len(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        assert len(cache) == 0
        cache["a"] = 1
        cache["b"] = 2
        assert len(cache) == 2

    def test_delitem(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        cache["a"] = 1
        del cache["a"]
        assert "a" not in cache

    def test_delitem_missing_raises(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        with pytest.raises(KeyError):
            del cache["missing"]

    def test_getitem_missing_raises(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        with pytest.raises(KeyError):
            cache["missing"]

    def test_eviction_when_over_maxlen(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        cache["c"] = 3
        assert "a" not in cache
        assert "b" in cache
        assert "c" in cache
        assert len(cache) == 2

    def test_getitem_refreshes_recency(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        # Access "a" so "b" becomes least-recently-used.
        assert cache["a"] == 1
        cache["c"] = 3
        assert "a" in cache
        assert "b" not in cache
        assert "c" in cache

    def test_setitem_overwrite_refreshes_recency(self) -> None:
        cache: BoundedLRUCache[str, int] = BoundedLRUCache(maxlen=2)
        cache["a"] = 1
        cache["b"] = 2
        # Re-set "a" so "b" becomes least-recently-used.
        cache["a"] = 10
        cache["c"] = 3
        assert cache["a"] == 10
        assert "b" not in cache
        assert "c" in cache


class TestDebouncedDedeuplicatedCache:
    def test_set_and_get(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        cache["key"] = 123
        assert cache["key"] == 123

    def test_contains(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        cache["key"] = 123
        assert "key" in cache
        assert "other" not in cache

    def test_len(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        assert len(cache) == 0
        cache["key"] = 1
        assert len(cache) == 1

    def test_delitem(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        cache["key"] = 1
        del cache["key"]
        assert "key" not in cache

    def test_getitem_missing_raises(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        with pytest.raises(KeyError):
            cache["missing"]

    def test_get_returns_none_when_missing(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        assert cache.get("missing") is None

    def test_get_returns_value_when_present(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        cache["key"] = 456
        assert cache.get("key") == 456

    def test_eviction_respects_max_size(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=2)
        cache["a"] = 1
        cache["b"] = 2
        cache["c"] = 3
        assert len(cache) == 2
        assert "a" not in cache
        assert "c" in cache

    def test_hash_key_is_deterministic(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        assert cache._hash_key("key") == cache._hash_key("key")

    def test_hash_key_distinct_for_different_keys(self) -> None:
        cache = DebouncedDedeuplicatedCache(max_size=10)
        assert cache._hash_key("a") != cache._hash_key("b")
