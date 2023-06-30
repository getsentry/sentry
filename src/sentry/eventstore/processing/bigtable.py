from sentry.utils.codecs import BytesCodec, JSONCodec
from sentry.utils.kvstore.bigtable import BigtableKVStorage
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper

from .base import EventProcessingStore


def BigtableEventProcessingStore(**options) -> EventProcessingStore:
    """
    Creates an instance of the processing store which uses Bigtable as its
    backend.

    Keyword argument are forwarded to the ``BigtableKVStorage`` constructor.
    """
    return EventProcessingStore(
        KVStorageCodecWrapper(
            BigtableKVStorage(**options),
            JSONCodec() | BytesCodec(),  # maintains functional parity with cache backend
        )
    )
