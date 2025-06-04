import pickle
import zlib
from typing import Any


class Codec:
    def encode(self, value: Any) -> bytes:
        raise NotImplementedError

    def decode(self, value: bytes) -> Any:
        raise NotImplementedError


class CompressedPickleCodec(Codec):
    def encode(self, value: Any) -> bytes:
        return zlib.compress(pickle.dumps(value))

    def decode(self, value: bytes) -> Any:
        return pickle.loads(zlib.decompress(value))
