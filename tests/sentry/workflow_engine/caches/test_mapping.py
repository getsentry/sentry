import pytest

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.mapping import (
    CacheMapping,
    test_only_clear_registered_namespaces,
)


class TestCacheMapping(TestCase):
    def setUp(self) -> None:
        test_only_clear_registered_namespaces()
        self.mapping = CacheMapping[int, str](lambda x: str(x))

    def test_key(self) -> None:
        assert self.mapping.key(123) == "123"

    def test_get__returns_none_when_not_set(self) -> None:
        assert self.mapping.get(1) is None

    def test_get__returns_value_when_set(self) -> None:
        self.mapping.set(1, "test_value", 60)
        assert self.mapping.get(1) == "test_value"

    def test_set__stores_value(self) -> None:
        self.mapping.set(42, "stored_value", 60)
        assert self.mapping.get(42) == "stored_value"

    def test_set__overwrites_existing_value(self) -> None:
        self.mapping.set(1, "first_value", 60)
        self.mapping.set(1, "second_value", 60)
        assert self.mapping.get(1) == "second_value"

    def test_delete__removes_value(self) -> None:
        self.mapping.set(1, "value_to_delete", 60)
        assert self.mapping.get(1) == "value_to_delete"

        result = self.mapping.delete(1)

        assert result is True
        assert self.mapping.get(1) is None

    def test_delete__returns_false_when_key_not_exists(self) -> None:
        result = self.mapping.delete(999)
        assert result is False

    def test_get_many__returns_empty_dict_for_empty_input(self) -> None:
        assert self.mapping.get_many([]) == {}

    def test_get_many__returns_values(self) -> None:
        for i in range(5):
            if i % 2 == 0:
                self.mapping.set(i, f"value_{i}")

        results = self.mapping.get_many([0, 1, 2, 3, 4])

        assert results == {
            0: "value_0",
            1: None,
            2: "value_2",
            3: None,
            4: "value_4",
        }

    def test_set_many__returns_empty_list_for_empty_input(self) -> None:
        assert self.mapping.set_many({}) == []

    def test_set_many__sets_values(self) -> None:
        data = {i: f"value_{i}" for i in range(5)}
        failed = self.mapping.set_many(data, 60)

        assert failed == []
        for i in range(5):
            assert self.mapping.get(i) == f"value_{i}"

    def test_delete_many__deletes_values(self) -> None:
        for i in range(4):
            self.mapping.set(i, f"value_{i}", 60)

        self.mapping.delete_many([0, 1, 2, 3])

        for i in range(4):
            assert self.mapping.get(i) is None

    def test_delete_many__handles_empty_input(self) -> None:
        self.mapping.delete_many([])

    def test_namespace__prefixes_key(self) -> None:
        mapping = CacheMapping[int, str](lambda x: str(x), namespace="test_ns")
        assert mapping.key(123) == "test_ns:123"

    def test_namespace__collision_raises(self) -> None:
        CacheMapping[int, str](lambda x: str(x), namespace="unique_ns")
        with pytest.raises(ValueError, match="already registered"):
            CacheMapping[int, str](lambda x: str(x), namespace="unique_ns")

    def test_namespace__none_does_not_prefix(self) -> None:
        mapping = CacheMapping[int, str](lambda x: f"raw:{x}")
        assert mapping.key(123) == "raw:123"
