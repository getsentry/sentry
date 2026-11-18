from __future__ import annotations

import os
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any
from unittest import mock

import pytest
from google.cloud.bigtable.data import (
    Cell,
    DeleteAllFromRow,
    Mutation,
    ReadRowsQuery,
    Row,
    RowMutationEntry,
    SetCell,
)
from google.cloud.bigtable.data import (
    Table as DataTable,
)

from sentry.services.nodestore.bigtable.backend import BigtableNodeStorage
from sentry.utils.kvstore.bigtable import BigtableKVStorage


class MockedBigtableKVStorage(BigtableKVStorage):
    class Table(DataTable):
        def __init__(self) -> None:
            self._rows: dict[bytes, dict[bytes, Cell]] = {}

        def read_row(self, row_key: str | bytes, **kwargs: Any) -> Row | None:
            if isinstance(row_key, str):
                row_key = row_key.encode("utf8")
            cells = self._rows.get(row_key)
            if not cells:
                return None
            return Row(row_key, list(cells.values()))

        def read_rows(self, query: ReadRowsQuery, **kwargs: Any) -> list[Row]:
            rows = [self.read_row(key) for key in query.row_keys]
            return [row for row in rows if row is not None]

        def mutate_row(
            self, row_key: str | bytes, mutations: list[Mutation] | Mutation, **kwargs: Any
        ) -> None:
            if isinstance(row_key, str):
                row_key = row_key.encode("utf8")
            if not isinstance(mutations, list):
                mutations = [mutations]
            for mutation in mutations:
                if isinstance(mutation, DeleteAllFromRow):
                    self._rows.pop(row_key, None)
                elif isinstance(mutation, SetCell):
                    self._rows.setdefault(row_key, {})[mutation.qualifier] = Cell(
                        mutation.new_value,
                        row_key,
                        mutation.family,
                        mutation.qualifier,
                        mutation.timestamp_micros,
                    )
                else:
                    raise NotImplementedError(mutation)

        def bulk_mutate_rows(self, mutation_entries: list[RowMutationEntry], **kwargs: Any) -> None:
            for entry in mutation_entries:
                self.mutate_row(entry.row_key, list(entry.mutations))

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._mock_table = MockedBigtableKVStorage.Table()

    def _get_table(self) -> MockedBigtableKVStorage.Table:
        return self._mock_table

    def bootstrap(self, automatic_expiry: bool = True) -> None:
        pass


class MockedBigtableNodeStorage(BigtableNodeStorage):
    store_class = MockedBigtableKVStorage


@contextmanager
def get_temporary_bigtable_nodestorage() -> Generator[BigtableNodeStorage]:
    if "BIGTABLE_EMULATOR_HOST" not in os.environ:
        pytest.skip(
            "Bigtable is not available, set BIGTABLE_EMULATOR_HOST environment variable to enable"
        )

    ns = BigtableNodeStorage(project="test")
    ns.bootstrap()

    try:
        yield ns
    finally:
        ns.store.destroy()


@pytest.fixture(params=[MockedBigtableNodeStorage, BigtableNodeStorage])
def ns(request: pytest.FixtureRequest) -> Generator[BigtableNodeStorage]:
    if request.param is BigtableNodeStorage:
        with get_temporary_bigtable_nodestorage() as ns:
            yield ns
    else:
        yield MockedBigtableNodeStorage(project="test")


@pytest.mark.django_db
def test_cache(ns: BigtableNodeStorage) -> None:
    node_1 = ("a" * 32, {"foo": "a"})
    node_2 = ("b" * 32, {"foo": "b"})
    node_3 = ("c" * 32, {"foo": "c"})

    for node_id, data in [node_1, node_2, node_3]:
        ns.set(node_id, data)

    # Get / get multi populates cache
    assert ns.get(node_1[0]) == node_1[1]
    assert ns.get_multi([node_2[0], node_3[0]]) == {
        node_2[0]: node_2[1],
        node_3[0]: node_3[1],
    }

    table = ns.store._get_table()

    with mock.patch.object(table, "read_row") as mock_read_row:
        assert ns.get(node_1[0]) == node_1[1]
        assert ns.get(node_2[0]) == node_2[1]
        assert ns.get(node_3[0]) == node_3[1]
        assert mock_read_row.call_count == 0

    with mock.patch.object(table, "read_rows") as mock_read_rows:
        assert ns.get_multi([node_1[0], node_2[0], node_3[0]])
        assert mock_read_rows.call_count == 0

    # Manually deleted item should still retrievable from cache
    table.mutate_row(node_1[0], DeleteAllFromRow())
    assert ns.get(node_1[0]) == node_1[1]
    assert ns.get_multi([node_1[0], node_2[0]]) == {
        node_1[0]: node_1[1],
        node_2[0]: node_2[1],
    }

    # Deletion clears cache
    ns.delete(node_1[0])
    assert ns.get_multi([node_1[0], node_2[0]]) == {node_1[0]: None, node_2[0]: node_2[1]}
    ns.delete_multi([node_1[0], node_2[0]])
    assert ns.get_multi([node_1[0], node_2[0]]) == {node_1[0]: None, node_2[0]: None}

    # Setting the item updates cache
    new_value = {"event_id": "d" * 32}
    ns.set(node_1[0], new_value)
    with mock.patch.object(table, "read_row") as mock_read_row:
        assert ns.get(node_1[0]) == new_value
        assert mock_read_row.call_count == 0

    # Missing rows are never cached
    assert ns.get("node_4") is None
    with mock.patch.object(table, "read_row") as mock_read_row:
        mock_read_row.return_value = None
        ns.get("node_4")
        ns.get("node_4")
        assert mock_read_row.call_count == 2


def test_compression() -> None:
    ns = BigtableNodeStorage(project="test", compression="zstd")
    assert ns.store.compression == "zstd"
    ns = BigtableNodeStorage(project="test", compression=True)
    assert ns.store.compression == "zlib"
    ns = BigtableNodeStorage(project="test", compression=False)
    assert ns.store.compression is None
