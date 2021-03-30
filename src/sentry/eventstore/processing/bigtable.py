from typing import Optional

from sentry.utils.codecs import BytesCodec, JSONCodec
from sentry.utils.kvstore.bigtable import BigtableKVStorage
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper

from .base import EventProcessingStore


def BigtableEventProcessingStore(
    instance: str,
    table_name: str,
    compression: Optional[str] = None,
) -> EventProcessingStore:
    """
    Creates an instance of the processing store which uses Bigtable as its
    backend.
    """
    return EventProcessingStore(
        KVStorageCodecWrapper(
            BigtableKVStorage(instance, table_name, compression=compression),
            JSONCodec() | BytesCodec(),
        )
    )
