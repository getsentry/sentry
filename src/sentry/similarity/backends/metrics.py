from collections.abc import Iterable, Iterator, Sequence
from typing import cast

from sentry.similarity.backends.abstract import (
    AbstractIndexBackend,
    ClassifyItem,
    CompareItem,
    ImportItem,
    IndexItem,
    RecordItem,
    SearchResult,
)
from sentry.utils.metrics import timer


class MetricsWrapper(AbstractIndexBackend):
    def __init__(
        self,
        backend: AbstractIndexBackend,
        template: str = "similarity.{}",
        scope_tag_name: str | None = "scope",
    ) -> None:
        self.backend = backend
        self.template = template
        self.scope_tag_name = scope_tag_name

    def __getattr__(self, name: str) -> object:
        return getattr(self.backend, name)

    def __instrumented_method_call(
        self, method: str, scope: str, *args: object, **kwargs: object
    ) -> object:
        tags = {}
        if self.scope_tag_name is not None:
            tags[self.scope_tag_name] = scope

        with timer(self.template.format(method), tags=tags):
            return getattr(self.backend, method)(scope, *args, **kwargs)

    def classify(
        self,
        scope: str,
        items: Sequence[ClassifyItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        return cast(
            "list[SearchResult]",
            self.__instrumented_method_call(
                "classify", scope, items, limit=limit, timestamp=timestamp
            ),
        )

    def compare(
        self,
        scope: str,
        key: str,
        items: Sequence[CompareItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        return cast(
            "list[SearchResult]",
            self.__instrumented_method_call(
                "compare", scope, key, items, limit=limit, timestamp=timestamp
            ),
        )

    def record(
        self,
        scope: str,
        key: str,
        items: Sequence[RecordItem],
        timestamp: int | None = None,
    ) -> object:
        return self.__instrumented_method_call("record", scope, key, items, timestamp=timestamp)

    def merge(
        self,
        scope: str,
        destination: str,
        items: Sequence[IndexItem],
        timestamp: int | None = None,
    ) -> object:
        return self.__instrumented_method_call(
            "merge", scope, destination, items, timestamp=timestamp
        )

    def delete(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> object:
        return self.__instrumented_method_call("delete", scope, items, timestamp=timestamp)

    def scan(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> Iterator[tuple[str, list[bytes]]]:
        return cast(
            "Iterator[tuple[str, list[bytes]]]",
            self.__instrumented_method_call(
                "scan", scope, indices, batch=batch, timestamp=timestamp
            ),
        )

    def flush(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> None:
        self.__instrumented_method_call("flush", scope, indices, batch=batch, timestamp=timestamp)

    def export(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> Iterable[object]:
        return cast(
            "Iterable[object]",
            self.__instrumented_method_call("export", scope, items, timestamp=timestamp),
        )

    def import_(
        self, scope: str, items: Sequence[ImportItem], timestamp: int | None = None
    ) -> object:
        return self.__instrumented_method_call("import_", scope, items, timestamp=timestamp)
