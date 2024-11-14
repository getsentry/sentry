from collections.abc import Iterator, Sequence
from datetime import timedelta

from sentry.utils.codecs import Codec, TDecoded, TEncoded
from sentry.utils.kvstore.abstract import K, KVStorage


class KVStorageCodecWrapper(KVStorage[K, TDecoded]):
    """
    This class provides a wrapper that can be used to transparently
    encode/decode values in the provided key/value storage to another type on
    reading and writing by using the provided codec. This allows key/value
    storages that have different value types to be used interchangably by
    wrapping one or both storages so that they expect a common type.
    """

    def __init__(
        self, store: KVStorage[K, TEncoded], value_codec: Codec[TDecoded, TEncoded]
    ) -> None:
        self.store = store
        self.value_codec = value_codec

    def get(self, key: K) -> TDecoded | None:
        value = self.store.get(key)
        if value is None:
            return None

        return self.value_codec.decode(value)

    def get_many(self, keys: Sequence[K]) -> Iterator[tuple[K, TDecoded]]:
        for key, value in self.store.get_many(keys):
            yield key, self.value_codec.decode(value)

    def set(self, key: K, value: TDecoded, ttl: timedelta | None = None) -> None:
        return self.store.set(key, self.value_codec.encode(value), ttl)

    def delete(self, key: K) -> None:
        return self.store.delete(key)

    def delete_many(self, keys: Sequence[K]) -> None:
        return self.store.delete_many(keys)

    def bootstrap(self, automatic_expiry: bool = True) -> None:
        return self.store.bootstrap()

    def destroy(self) -> None:
        return self.store.destroy()
