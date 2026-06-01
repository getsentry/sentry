from sentry.spans.consumers.process_segments.message import BoundedLRUCache


class TestBoundedLRUCache:
    def test_get_returns_none_on_miss(self):
        cache = BoundedLRUCache(max_size=4)
        assert cache.get("a") is None

    def test_set_and_get(self):
        cache = BoundedLRUCache(max_size=4)
        cache.set("a", 100)
        assert cache.get("a") == 100

    def test_overwrite_existing_key(self):
        cache = BoundedLRUCache(max_size=4)
        cache.set("a", 100)
        cache.set("a", 200)
        assert cache.get("a") == 200
        assert len(cache.cache) == 1

    def test_evicts_lru_when_full(self):
        cache = BoundedLRUCache(max_size=3)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        # Cache is at capacity. Adding a 4th key evicts "a" (least recently used).
        cache.set("d", 4)
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3
        assert cache.get("d") == 4

    def test_get_promotes_key_preventing_eviction(self):
        cache = BoundedLRUCache(max_size=3)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        # Access "a" to promote it — "b" is now the LRU entry.
        cache.get("a")
        cache.set("d", 4)
        assert cache.get("a") == 1
        assert cache.get("b") is None

    def test_set_promotes_key_preventing_eviction(self):
        cache = BoundedLRUCache(max_size=3)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        # Overwrite "a" to promote it — "b" is now the LRU entry.
        cache.set("a", 10)
        cache.set("d", 4)
        assert cache.get("a") == 10
        assert cache.get("b") is None

    def test_max_size_of_one(self):
        cache = BoundedLRUCache(max_size=1)
        cache.set("a", 1)
        assert cache.get("a") == 1
        cache.set("b", 2)
        assert cache.get("a") is None
        assert cache.get("b") == 2

    def test_distinct_keys_do_not_collide(self):
        cache = BoundedLRUCache(max_size=100)
        cache.set("1:production:v1.0:", 100)
        cache.set("1:production:v2.0:", 200)
        assert cache.get("1:production:v1.0:") == 100
        assert cache.get("1:production:v2.0:") == 200

    def test_hash_key_is_deterministic(self):
        cache = BoundedLRUCache(max_size=4)
        h1 = cache._hash_key("some-key")
        h2 = cache._hash_key("some-key")
        assert h1 == h2

    def test_hash_key_returns_int(self):
        cache = BoundedLRUCache(max_size=4)
        assert isinstance(cache._hash_key("key"), int)
