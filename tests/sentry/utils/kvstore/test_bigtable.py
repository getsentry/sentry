import os
from typing import Optional

import pytest

from sentry.utils.kvstore.bigtable import BigtableKVStorage


@pytest.fixture
def create_store_test(compression: Optional[str] = None) -> BigtableKVStorage:
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
    yield store
    store.destroy()


@pytest.mark.parametrize(
    "compression,flag,expected_prefix",
    [
        (None, None, b"{"),
        ("zlib", BigtableKVStorage.Flags.COMPRESSED_ZLIB, (b"\x78\x01", b"\x78\x9c", b"\x78\xda")),
        ("zstd", BigtableKVStorage.Flags.COMPRESSED_ZSTD, b"\x28\xb5\x2f\xfd"),
    ],
    ids=["zlib", "ident", "zstd"],
)
@pytest.mark.usefixtures("create_store_test")
def test_compression_raw_values(
    compression: Optional[str],
    flag: BigtableKVStorage.Flags,
    expected_prefix: bytes,
    request,
) -> None:
    store = create_store_test(compression)

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


@pytest.mark.usefixtures("create_store_test")
def test_compression_compatibility() -> None:
    stores = {
        compression: create_store_test(compression)
        for compression in BigtableKVStorage.compression_strategies.keys() | {None}
    }

    value = b"value"

    for compression, writer in stores.items():
        key = f"{compression}/key"
        writer.set(key, value)

        for reader in stores.values():
            assert reader.get(key) == value
