import itertools
import pytest
from dataclasses import dataclass
from typing import Iterator, Tuple

from sentry.utils.kvstore import K, KVStorage, V


@dataclass
class TestProperties:
    store: KVStorage[K, V]
    keys: Iterator[K]
    values: Iterator[V]

    @property
    def items(self) -> Iterator[Tuple[K, V]]:
        return zip(self.keys, self.values)


@pytest.fixture
def properties(request) -> TestProperties:
    raise NotImplementedError


def test_single_key_operations(properties: TestProperties) -> None:
    store = properties.store
    key, value = next(properties.keys), next(properties.values)

    # Test setting a key with no prior value.
    store.set(key, value)
    assert store.get(key) == value

    # Test overwriting a key with a prior value.
    new_value = next(properties.values)
    store.set(key, new_value)
    assert store.get(key) == new_value

    # Test deleting an existing key.
    store.delete(key)
    assert store.get(key) is None

    # Test reading a missing key.
    missing_key = next(properties.keys)
    assert store.get(missing_key) is None

    # Test deleting a missing key.
    store.delete(missing_key)


def test_multiple_key_operations(properties: TestProperties) -> None:
    store = properties.store

    items = dict(itertools.islice(properties.items, 10))
    for key, value in items.items():
        store.set(key, value)

    missing_keys = set(itertools.islice(properties.keys, 5))

    all_keys = list(items.keys() | missing_keys)

    # Test reading a combination of present and missing keys.
    assert dict(store.get_many(all_keys)) == items

    # Test deleting a combination of present and missing keys.
    store.delete_many(all_keys)

    assert dict(store.get_many(all_keys)) == {}
