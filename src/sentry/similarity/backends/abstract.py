from abc import ABCMeta, abstractmethod
from collections.abc import Iterable, Iterator, Sequence

FeatureData = Sequence[bytes]
ClassifyItem = tuple[str, float, FeatureData]
CompareItem = tuple[str, float]
RecordItem = tuple[str, FeatureData]
IndexItem = tuple[str, str]
ImportItem = tuple[str, str, object]
SearchResult = tuple[str, list[float | int | None]]


class AbstractIndexBackend(metaclass=ABCMeta):
    @abstractmethod
    def classify(
        self,
        scope: str,
        items: Sequence[ClassifyItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        pass

    @abstractmethod
    def compare(
        self,
        scope: str,
        key: str,
        items: Sequence[CompareItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        pass

    @abstractmethod
    def record(
        self,
        scope: str,
        key: str,
        items: Sequence[RecordItem],
        timestamp: int | None = None,
    ) -> object:
        pass

    @abstractmethod
    def merge(
        self,
        scope: str,
        destination: str,
        items: Sequence[IndexItem],
        timestamp: int | None = None,
    ) -> object:
        pass

    @abstractmethod
    def delete(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> object:
        pass

    @abstractmethod
    def scan(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> Iterator[tuple[str, list[bytes]]]:
        pass

    @abstractmethod
    def flush(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> None:
        pass

    @abstractmethod
    def export(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> Iterable[object]:
        pass

    @abstractmethod
    def import_(
        self, scope: str, items: Sequence[ImportItem], timestamp: int | None = None
    ) -> object:
        pass
