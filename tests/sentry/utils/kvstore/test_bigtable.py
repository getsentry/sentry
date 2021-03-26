import itertools
import os
from typing import Iterator, Optional

import pytest
from google.oauth2.credentials import Credentials
from sentry.utils.kvstore.abstract import K, KVStorage, V
from sentry.utils.kvstore.bigtable import BigtableKVStorage


@pytest.fixture
def credentials() -> Credentials:
    if "BIGTABLE_EMULATOR_HOST" not in os.environ:
        pytest.skip(
            "Bigtable is not available, set BIGTABLE_EMULATOR_HOST environment variable to enable"
        )

    # The bigtable emulator requires _something_ to be passed as credentials,
    # even if they're totally bogus ones.
    return Credentials.from_authorized_user_info(
        {key: "invalid" for key in ["client_id", "refresh_token", "client_secret"]}
    )


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
    compression: Optional[str],
    flag: BigtableKVStorage.Flags,
    expected_prefix: bytes,
    credentials: Credentials,
    request,
) -> None:
    store = BigtableKVStorage(
        project="test",
        compression=compression,
        client_options={"credentials": credentials},
    )

    store.bootstrap()
    request.addfinalizer(store.destroy)

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


def test_compression_compatibility(request, credentials: Credentials) -> None:
    stores = {
        compression: BigtableKVStorage(
            project="test",
            compression=compression,
            client_options={"credentials": credentials},
        )
        for compression in BigtableKVStorage.compression_strategies.keys() | {None}
    }

    stores[None].bootstrap()
    request.addfinalizer(stores[None].destroy)

    value = b"value"

    for compression, writer in stores.items():
        key = f"{compression}/key"
        writer.set(key, value)

        for reader in stores.values():
            assert reader.get(key) == value


@pytest.fixture
def store(credentials: Credentials) -> KVStorage[str, bytes]:
    store = BigtableKVStorage(
        project="test",
        client_options={"credentials": credentials},
    )
    store.bootstrap()
    yield store
    store.destroy()


@pytest.fixture
def keys() -> Iterator[str]:
    return (f"{i}" for i in itertools.count())


@pytest.fixture
def values() -> Iterator[bytes]:
    return (f"{i}".encode("utf-8") for i in itertools.count())


def test_single_key_operations(
    store: KVStorage[K, V], keys: Iterator[K], values: Iterator[V]
) -> None:
    key, value = next(keys), next(values)

    # Test setting a key with no prior value.
    store.set(key, value)
    assert store.get(key) == value

    # Test overwriting a key with a prior value.
    new_value = next(values)
    store.set(key, new_value)
    assert store.get(key) == new_value

    # Test deleting an existing key.
    store.delete(key)
    assert store.get(key) is None

    # Test reading a missing key.
    missing_key = next(keys)
    assert store.get(missing_key) is None

    # Test deleting a missing key.
    store.delete(missing_key)


def test_multiple_key_operations(
    store: KVStorage[K, V], keys: Iterator[K], values: Iterator[V]
) -> None:
    items = dict(itertools.islice(zip(keys, values), 10))
    for key, value in items.items():
        store.set(key, value)

    missing_keys = set(itertools.islice(keys, 5))

    all_keys = list(items.keys() | missing_keys)

    # Test reading a combination of present and missing keys.
    assert dict(store.get_many(all_keys)) == items

    # Test deleting a combination of present and missing keys.
    store.delete_many(all_keys)

    assert dict(store.get_many(all_keys)) == {}
