from __future__ import annotations

import functools
import os
import time
from collections.abc import Callable
from datetime import timedelta
from unittest import mock

import pytest
from google.cloud.bigtable.data import DeleteAllFromRow, MutationsExceptionGroup

from sentry.utils.kvstore.bigtable import BigtableError, BigtableKVStorage


def create_store(
    request: pytest.FixtureRequest, compression: str | None = None
) -> BigtableKVStorage:
    if "BIGTABLE_EMULATOR_HOST" not in os.environ:
        pytest.skip(
            "Bigtable is not available, set BIGTABLE_EMULATOR_HOST environment variable to enable"
        )
    store = BigtableKVStorage(
        project="test",
        instance="test",
        table_name="test",
        compression=compression,
    )
    store.bootstrap()
    request.addfinalizer(store.destroy)
    return store


@pytest.fixture
def store_factory(request: pytest.FixtureRequest) -> Callable[[str | None], BigtableKVStorage]:
    return functools.partial(create_store, request)


@pytest.mark.parametrize(
    "compression,flag,expected_prefix",
    [
        (None, None, b"{"),
        ("zlib", BigtableKVStorage.Flags.COMPRESSED_ZLIB, (b"\x78\x01", b"\x78\x9c", b"\x78\xda")),
        ("zstd", BigtableKVStorage.Flags.COMPRESSED_ZSTD, b"\x28\xb5\x2f\xfd"),
    ],
    ids=["zlib", "ident", "zstd"],
)
def test_compression_raw_values(
    compression: str | None,
    flag: BigtableKVStorage.Flags | None,
    expected_prefix: bytes | tuple[bytes, ...],
    request: pytest.FixtureRequest,
    store_factory: Callable[[str | None], BigtableKVStorage],
) -> None:
    store = store_factory(compression)

    key = "key"
    value = b'{"foo":"bar"}'

    store.set(key, value)
    assert store.get(key) == value

    row = store._get_table().read_row(key)
    assert row is not None

    # Check that the data is what we would expect to see after compression.
    [data_cell] = row.get_cells(store.column_family, store.data_column)
    assert data_cell.value.startswith(expected_prefix)

    # Check the presence and validity of the compression flag.
    if flag is not None:
        [flags_cell] = row.get_cells(store.column_family, store.flags_column)
        [flags] = store.flags_struct.unpack(flags_cell.value)
        assert flag in BigtableKVStorage.Flags(flags)
    else:
        assert (store.column_family, store.flags_column) not in row


def test_compression_compatibility(
    request: pytest.FixtureRequest, store_factory: Callable[[str | None], BigtableKVStorage]
) -> None:
    stores = {
        compression: store_factory(compression)
        for compression in BigtableKVStorage.compression_strategies.keys() | {None}
    }

    value = b"value"

    for compression, writer in stores.items():
        key = f"{compression}/key"
        writer.set(key, value)

        for reader in stores.values():
            assert reader.get(key) == value


def test_get_uses_5s_operation_timeout() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        mock_table.read_row.return_value = None

        store.get("some-key")

    mock_table.read_row.assert_called_once_with("some-key", operation_timeout=5.0)


def test_ttl_expiry(store_factory: Callable[[str | None], BigtableKVStorage]) -> None:
    store = store_factory(None)

    store.set("short", b"value", ttl=timedelta(hours=1))
    store.set("long", b"value", ttl=timedelta(hours=3))
    assert store.get("short") == b"value"

    two_hours_later_ns = time.time_ns() + int(timedelta(hours=2).total_seconds() * 1e9)
    with mock.patch("sentry.utils.kvstore.bigtable.time") as mock_time:
        mock_time.time_ns.return_value = two_hours_later_ns
        assert store.get("short") is None
        assert store.get("long") == b"value"
        assert dict(store.get_many(["short", "long", "missing"])) == {"long": b"value"}


def test_delete(store_factory: Callable[[str | None], BigtableKVStorage]) -> None:
    store = store_factory("zstd")
    for key in ("a", "b", "c"):
        store.set(key, key.encode())

    store.delete("a")
    store.delete_many(["b", "missing"])
    store.delete_many([])

    assert dict(store.get_many(["a", "b", "c"])) == {"c": b"c"}


def test_set_uses_consistent_millisecond_timestamps() -> None:
    store = BigtableKVStorage("test", "test", "test", compression="zlib")
    mock_table = mock.Mock()
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        store.set("some-key", b"value", ttl=timedelta(days=1))

    [(key, mutations), _] = mock_table.mutate_row.call_args
    assert key == "some-key"
    assert isinstance(mutations[0], DeleteAllFromRow)
    set_cells = mutations[1:]
    assert [m.qualifier for m in set_cells] == [
        store.ttl_column,
        store.flags_column,
        store.data_column,
    ]
    [timestamp] = {m.timestamp_micros for m in set_cells}
    assert timestamp % 1000 == 0


def test_delete_many_raises_bigtable_error() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.bulk_mutate_rows.side_effect = MutationsExceptionGroup(
        [ValueError("failed")], total_entries=2
    )
    with (
        mock.patch.object(store, "_get_table", return_value=mock_table),
        pytest.raises(BigtableError),
    ):
        store.delete_many(["a", "b"])


def test_client_is_closed_at_thread_shutdown() -> None:
    store = BigtableKVStorage("test", "test", "test")
    with (
        mock.patch("sentry.utils.kvstore.bigtable.BigtableDataClient") as client_cls,
        mock.patch("threading._register_atexit") as register_atexit,
    ):
        table = store._get_table()
        assert store._get_table() is table
        register_atexit.assert_called_once_with(store._close_client)

        store._close_client()

    client_cls.return_value.close.assert_called_once_with()


def test_table_uses_legacy_retry_budgets() -> None:
    store = BigtableKVStorage("test", "test", "test", app_profile="profile")
    with (
        mock.patch("sentry.utils.kvstore.bigtable.BigtableDataClient") as client_cls,
        mock.patch("threading._register_atexit"),
    ):
        store._get_table()

    client_cls.return_value.get_table.assert_called_once_with(
        "test",
        "test",
        app_profile_id="profile",
        default_read_rows_operation_timeout=60,
        default_mutate_rows_operation_timeout=120,
    )
