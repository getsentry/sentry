from __future__ import annotations

import functools
import os
from collections.abc import Callable
from unittest import mock

import pytest

from sentry.utils.kvstore.bigtable import BigtableKVStorage


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

    columns = store._get_table().read_row(key).cells[store.column_family]

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


def test_project_from_environment_variables() -> None:
    """Test that project is read from environment variables when not explicitly provided."""
    # Test with GOOGLE_CLOUD_PROJECT
    with mock.patch.dict(os.environ, {"GOOGLE_CLOUD_PROJECT": "env-project"}):
        store = BigtableKVStorage(instance="test", table_name="test")
        assert store.project == "env-project"

    # Test with GCLOUD_PROJECT fallback
    with mock.patch.dict(os.environ, {"GCLOUD_PROJECT": "gcloud-project"}, clear=True):
        store = BigtableKVStorage(instance="test", table_name="test")
        assert store.project == "gcloud-project"

    # Test with GCP_PROJECT fallback
    with mock.patch.dict(os.environ, {"GCP_PROJECT": "gcp-project"}, clear=True):
        store = BigtableKVStorage(instance="test", table_name="test")
        assert store.project == "gcp-project"

    # Test that explicit project parameter takes precedence
    with mock.patch.dict(os.environ, {"GOOGLE_CLOUD_PROJECT": "env-project"}):
        store = BigtableKVStorage(instance="test", table_name="test", project="explicit-project")
        assert store.project == "explicit-project"

    # Test that project is None when not provided and no env vars are set
    with mock.patch.dict(os.environ, {}, clear=True):
        store = BigtableKVStorage(instance="test", table_name="test")
        assert store.project is None
