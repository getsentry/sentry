from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.cache_access import CacheAccess


class _TestCacheAccess(CacheAccess[str]):
    """Concrete implementation for testing the abstract CacheAccess class."""

    def __init__(self, cache_key: str):
        self._cache_key = cache_key

    def key(self) -> str:
        return self._cache_key


class TestCacheAccess(TestCase):
    def setUp(self) -> None:
        self.cache_key = "test_cache_key"
        self.cache_access = _TestCacheAccess(self.cache_key)

    def test_key(self) -> None:
        assert self.cache_access.key() == self.cache_key

    def test_get__returns_none_when_not_set(self) -> None:
        assert self.cache_access.get() is None

    def test_get__returns_value_when_set(self) -> None:
        self.cache_access.set("test_value", 60)
        assert self.cache_access.get() == "test_value"

    def test_set__stores_value(self) -> None:
        self.cache_access.set("stored_value", 60)
        assert self.cache_access.get() == "stored_value"

    def test_set__overwrites_existing_value(self) -> None:
        self.cache_access.set("first_value", 60)
        self.cache_access.set("second_value", 60)
        assert self.cache_access.get() == "second_value"

    def test_delete__removes_value(self) -> None:
        self.cache_access.set("value_to_delete", 60)
        assert self.cache_access.get() == "value_to_delete"

        result = self.cache_access.delete()

        assert result is True
        assert self.cache_access.get() is None

    def test_delete__returns_false_when_key_not_exists(self) -> None:
        result = self.cache_access.delete()
        assert result is False

    def test_delete_many__deletes_values(self) -> None:
        keys = [f"val_{i}" for i in range(4)]
        accessors = [_TestCacheAccess(key) for key in keys]
        for accessor in accessors:
            accessor.set("value", 5321)
        _TestCacheAccess.delete_many(accessors)
        for accessor in accessors:
            assert accessor.get() is None

    def test_get_many(self) -> None:
        accessors = []
        for i in range(5):
            accessor = _TestCacheAccess(f"val_{i}")
            if i % 2 == 0:
                accessor.set("some_string")
            accessors.append(accessor)
        results = _TestCacheAccess.get_many(accessors)
        results_by_key = {accessor.key(): result for accessor, result in results.items()}
        assert results_by_key == {
            "val_0": "some_string",
            "val_1": None,
            "val_2": "some_string",
            "val_3": None,
            "val_4": "some_string",
        }

    def test_set_many(self) -> None:
        accessors = [_TestCacheAccess(f"val_{i}") for i in range(5)]
        failed_accessors = _TestCacheAccess.set_many(
            {accessor: "some_string" for accessor in accessors}, 60
        )
        assert failed_accessors == []
        for accessor in accessors:
            assert accessor.get() == "some_string"
