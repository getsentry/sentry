import zlib
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, cast

import zstandard

from sentry.utils import json
from sentry.utils.json import JSONData

T = TypeVar("T")

TDecoded = TypeVar("TDecoded")
TEncoded = TypeVar("TEncoded")


class Codec(ABC, Generic[TDecoded, TEncoded]):
    """
    Codes provides bidirectional encoding/decoding (mapping) from one type
    to another.
    """

    @abstractmethod
    def encode(self, value: TDecoded) -> TEncoded:
        raise NotImplementedError

    @abstractmethod
    def decode(self, value: TEncoded) -> TDecoded:
        raise NotImplementedError

    def __or__(self, codec: "Codec[TEncoded, T]") -> "Codec[TDecoded, T]":
        """
        Create a new codec by pipelining it with another codec.

        When encoding, the output of this codec is provided as the input to
        the provided codec. When decoding, the output of the provided codec
        is used as the input to this codec.
        """
        return ChainedCodec(self, codec)


class ChainedCodec(Codec[TDecoded, TEncoded]):
    def __init__(self, outer: Codec[TDecoded, T], inner: Codec[T, TEncoded]) -> None:
        self.outer = outer
        self.inner = inner

    def encode(self, value: TDecoded) -> TEncoded:
        return self.inner.encode(self.outer.encode(value))

    def decode(self, value: TEncoded) -> TDecoded:
        return self.outer.decode(self.inner.decode(value))


class BytesCodec(Codec[str, bytes]):
    """
    Encode/decode strings to/from bytes using the encoding provided to the
    constructor.
    """

    def __init__(self, encoding: str = "utf8"):
        self.encoding = encoding

    def encode(self, value: str) -> bytes:
        return value.encode(self.encoding)

    def decode(self, value: bytes) -> str:
        return value.decode(self.encoding)


class JSONCodec(Codec[JSONData, str]):
    """
    Encode/decode Python data structures to/from JSON-encoded strings.
    """

    def encode(self, value: JSONData) -> str:
        return str(json.dumps(value))

    def decode(self, value: str) -> JSONData:
        return json.loads(value)


class ZlibCodec(Codec[bytes, bytes]):
    def encode(self, value: bytes) -> bytes:
        return zlib.compress(value)

    def decode(self, value: bytes) -> bytes:
        return zlib.decompress(value)


class ZstdCodec(Codec[bytes, bytes]):
    def encode(self, value: bytes) -> bytes:
        return cast(bytes, zstandard.ZstdCompressor().compress(value))

    def decode(self, value: bytes) -> bytes:
        return cast(bytes, zstandard.ZstdDecompressor().decompress(value))
