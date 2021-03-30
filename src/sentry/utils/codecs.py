from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from sentry.utils import json
from sentry.utils.json import JSONData

T = TypeVar("T")

TDecoded = TypeVar("TDecoded")
TEncoded = TypeVar("TEncoded")


class Codec(ABC, Generic[TDecoded, TEncoded]):
    @abstractmethod
    def encode(self, value: TDecoded) -> TEncoded:
        raise NotImplementedError

    @abstractmethod
    def decode(self, value: TEncoded) -> TDecoded:
        raise NotImplementedError

    def __or__(self, codec: "Codec[TEncoded, T]") -> "Codec[TDecoded, T]":
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
    def __init__(self, encoding: str = "utf8"):
        self.encoding = encoding

    def encode(self, value: str) -> bytes:
        return value.encode(self.encoding)

    def decode(self, value: bytes) -> str:
        return value.decode(self.encoding)


class JSONCodec(Codec[JSONData, str]):
    def encode(self, value: JSONData) -> str:
        return json.dumps(value)

    def decode(self, value: str) -> JSONData:
        return json.loads(value)
