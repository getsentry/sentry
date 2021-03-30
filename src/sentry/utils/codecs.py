from abc import ABC, abstractmethod
from typing import Generic, TypeVar


TDecoded = TypeVar("TDecoded")
TEncoded = TypeVar("TEncoded")


class Codec(ABC, Generic[TDecoded, TEncoded]):
    @abstractmethod
    def encode(self, value: TDecoded) -> TEncoded:
        raise NotImplementedError

    @abstractmethod
    def decode(self, value: TEncoded) -> TDecoded:
        raise NotImplementedError
