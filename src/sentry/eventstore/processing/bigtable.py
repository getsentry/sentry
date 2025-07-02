from __future__ import annotations

from typing import Any

from sentry.utils.codecs import BytesCodec, JSONCodec
from sentry.utils.kvstore.bigtable import BigtableKVStorage
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper

from .base import EventProcessingStore


class BigtableEventProcessingStore(EventProcessingStore):
    """
    Creates an instance of the processing store which uses Bigtable as its
    backend.

    Keyword argument are forwarded to the ``BigtableKVStorage`` constructor.
    """

    def __init__(self, **options: Any) -> None:
        super().__init__(
            KVStorageCodecWrapper(
                BigtableKVStorage(**options),
                JSONCodec() | BytesCodec(),  # maintains functional parity with cache backend
            )
        )
