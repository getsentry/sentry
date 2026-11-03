from collections.abc import Iterable, Iterator, Sequence

from sentry.similarity.backends.abstract import (
    AbstractIndexBackend,
    ClassifyItem,
    CompareItem,
    ImportItem,
    IndexItem,
    RecordItem,
    SearchResult,
)


class DummyIndexBackend(AbstractIndexBackend):
    def classify(
        self,
        scope: str,
        items: Sequence[ClassifyItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        return []

    def compare(
        self,
        scope: str,
        key: str,
        items: Sequence[CompareItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        return []

    def record(
        self,
        scope: str,
        key: str,
        items: Sequence[RecordItem],
        timestamp: int | None = None,
    ) -> object:
        return {}

    def merge(
        self,
        scope: str,
        destination: str,
        items: Sequence[IndexItem],
        timestamp: int | None = None,
    ) -> object:
        return False

    def delete(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> object:
        return False

    def scan(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> Iterator[tuple[str, list[bytes]]]:
        # empty generator
        yield from ()

    def flush(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> None:
        pass

    def export(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> Iterable[object]:
        return {}

    def import_(
        self, scope: str, items: Sequence[ImportItem], timestamp: int | None = None
    ) -> object:
        return {}
