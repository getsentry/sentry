from __future__ import annotations

import functools
import os
from collections.abc import Callable
from unittest import mock

import pytest
from google.api_core import exceptions
from google.rpc.status_pb2 import Status

from sentry.utils.kvstore.bigtable import (
    BigtableError,
    BigtableKVStorage,
    bigtable_operation_timeout,
)


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
    columns = row.cells[store.column_family]

    # Check that the data is what we would expect to see after compression.
    assert columns[store.data_column][0].value.startswith(expected_prefix)

    # Check the presence and validity of the compression flag.
    if flag is not None:
        [flags] = store.flags_struct.unpack(columns[store.flags_column][0].value)
        assert flag in BigtableKVStorage.Flags(flags)
    else:
        assert store.flags_column not in columns


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


def test_get_uses_5s_timeout_for_retry() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    with (
        mock.patch.object(store, "_get_table", return_value=mock_table),
        mock.patch("sentry_sdk.start_span"),
    ):
        mock_table.read_row.return_value = None

        store.get("some-key")

        # Check the retry argument
        _, kwargs = mock_table.read_row.call_args
        retry_arg = kwargs["retry"]
        assert hasattr(retry_arg, "_timeout")
        assert retry_arg._timeout == 5.0


def test_get_uses_tighter_context_timeout() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.read_row.return_value = None
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(2.0):
            store.get("some-key")
        _, kwargs = mock_table.read_row.call_args
        assert kwargs["retry"]._timeout == 2.0

        with bigtable_operation_timeout(30.0):
            store.get("some-key")
        _, kwargs = mock_table.read_row.call_args
        assert kwargs["retry"]._timeout == 5.0


def test_get_many_uses_context_timeout() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.read_rows.return_value = []
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(7.0):
            list(store.get_many(["some-key"]))

    _, kwargs = mock_table.read_rows.call_args
    assert kwargs["retry"]._timeout == 7.0


def test_set_without_context_timeout_uses_defaults() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    mock_table.mutate_rows.return_value = [Status(code=0)]
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        store.set("some-key", b"value")

    mock_table.mutate_rows.assert_called_once_with([mock_table.direct_row.return_value])


def test_set_uses_context_timeout() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    mock_table.mutate_rows.return_value = [Status(code=0)]
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(20.0):
            store.set("some-key", b"value")

    _, kwargs = mock_table.mutate_rows.call_args
    assert kwargs["retry"]._timeout == 20.0
    assert kwargs["timeout"] == 20.0
    mock_table.direct_row.return_value.clear.assert_called_once_with()


def test_delete_attempt_timeout_is_at_least_one_second() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    mock_table.mutate_rows.return_value = [Status(code=0)]
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(0.5):
            store.delete("some-key")

    _, kwargs = mock_table.mutate_rows.call_args
    assert kwargs["retry"]._timeout == 0.5
    assert kwargs["timeout"] == 1.0


def test_set_raises_when_mutation_times_out() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    # The client reports a ``None`` status for rows that ran out of retry time.
    mock_table.mutate_rows.return_value = [None]
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(1.0), pytest.raises(BigtableError):
            store.set("some-key", b"value")


def test_delete_many_raises_when_mutation_times_out() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.mutate_rows.return_value = [Status(code=0), None]
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(1.0), pytest.raises(BigtableError):
            store.delete_many(["a", "b"])


def test_nested_context_cannot_loosen_timeout() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    mock_table.mutate_rows.return_value = [Status(code=0)]
    with mock.patch.object(store, "_get_table", return_value=mock_table):
        with bigtable_operation_timeout(10.0):
            with bigtable_operation_timeout(30.0):
                store.set("some-key", b"value")
            _, kwargs = mock_table.mutate_rows.call_args
            assert kwargs["retry"]._timeout == 10.0

            with bigtable_operation_timeout(5.0):
                store.set("some-key", b"value")
            _, kwargs = mock_table.mutate_rows.call_args
            assert kwargs["retry"]._timeout == 5.0

            # Exiting the inner context restores the outer timeout.
            store.set("some-key", b"value")
            _, kwargs = mock_table.mutate_rows.call_args
            assert kwargs["retry"]._timeout == 10.0


def test_set_retry_shares_context_timeout() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    mock_table.mutate_rows.side_effect = [
        exceptions.ServiceUnavailable("unavailable"),
        [Status(code=0)],
    ]
    with (
        mock.patch.object(store, "_get_table", return_value=mock_table),
        mock.patch("sentry.utils.kvstore.bigtable.time.monotonic", side_effect=[100.0, 108.0]),
    ):
        store._BigtableKVStorage__table = mock_table  # type: ignore[attr-defined]
        with bigtable_operation_timeout(20.0):
            store.set("some-key", b"value")

    _, kwargs = mock_table.mutate_rows.call_args
    assert kwargs["retry"]._timeout == 12.0


def test_set_does_not_retry_when_context_timeout_is_spent() -> None:
    store = BigtableKVStorage("test", "test", "test")
    mock_table = mock.Mock()
    mock_table.direct_row.return_value.table = mock_table
    mock_table.mutate_rows.side_effect = exceptions.ServiceUnavailable("unavailable")
    with (
        mock.patch.object(store, "_get_table", return_value=mock_table),
        mock.patch("sentry.utils.kvstore.bigtable.time.monotonic", side_effect=[100.0, 121.0]),
    ):
        store._BigtableKVStorage__table = mock_table  # type: ignore[attr-defined]
        with bigtable_operation_timeout(20.0), pytest.raises(exceptions.ServiceUnavailable):
            store.set("some-key", b"value")

    assert mock_table.mutate_rows.call_count == 1
