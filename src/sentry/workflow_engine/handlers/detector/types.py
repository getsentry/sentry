from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class EvidenceData(Generic[T]):
    value: T
