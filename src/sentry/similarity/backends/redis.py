import itertools
import time
from collections.abc import Callable, Iterable, Iterator, Sequence
from typing import Protocol, cast

from django.utils.encoding import force_str

from sentry.similarity.backends.abstract import (
    AbstractIndexBackend,
    ClassifyItem,
    CompareItem,
    ImportItem,
    IndexItem,
    RecordItem,
    SearchResult,
)
from sentry.utils.iterators import chunked
from sentry.utils.redis import load_redis_script

index = load_redis_script("similarity/index.lua")


class Cluster(Protocol):
    def delete(self, *keys: bytes) -> object: ...


def band(n: int, value: Sequence[int]) -> list[list[int]]:
    assert len(value) % n == 0
    return list(chunked(value, cast(int, len(value) / n)))


def flatten(value: Iterable[Iterable[object]]) -> list[object]:
    return list(itertools.chain.from_iterable(value))


class RedisScriptMinHashIndexBackend(AbstractIndexBackend):
    def __init__(
        self,
        cluster: Cluster,
        namespace: str,
        signature_builder: Callable[[Sequence[bytes]], Sequence[int]],
        bands: int,
        interval: int,
        retention: int,
        candidate_set_limit: int,
    ) -> None:
        self.cluster = cluster
        self.namespace = namespace
        self.signature_builder = signature_builder
        self.bands = bands
        self.interval = interval
        self.retention = retention
        self.candidate_set_limit = candidate_set_limit

    def _build_signature_arguments(self, features: Sequence[bytes]) -> list[object]:
        if not features:
            return [0] * self.bands

        arguments: list[object] = []
        for bucket in band(self.bands, self.signature_builder(features)):
            arguments.extend([1, ",".join(str(b) for b in bucket), 1])
        return arguments

    def __index(self, scope: str, args: Sequence[object]) -> list[object]:
        # scope must be passed into the script call as a key to allow the
        # cluster client to determine what cluster the script should be
        # executed on. The script itself will use the scope as the hashtag for
        # all redis operations.
        return index([scope], args, self.cluster)

    def _as_search_result(
        self, results: Iterable[tuple[bytes | str, Sequence[float]]]
    ) -> list[SearchResult]:
        score_replacements = {
            -1.0: None,  # both items don't have the feature (no comparison)
            -2.0: 0,  # one item doesn't have the feature (totally dissimilar)
        }

        def decode_search_result(result: tuple[bytes | str, Sequence[float]]) -> SearchResult:
            key, scores = result
            return (
                force_str(key),
                [score_replacements.get(float(score), float(score)) for score in scores],
            )

        def get_comparison_key(result: SearchResult) -> tuple[float, int, str]:
            key, scores = result

            averaged_scores = [score for score in scores if score is not None]

            return (
                sum(averaged_scores) / len(averaged_scores) * -1,  # average score, descending
                len(averaged_scores) * -1,  # number of indexes with scores, descending
                key,  # lexicographical sort on key, ascending
            )

        return sorted((decode_search_result(result) for result in results), key=get_comparison_key)

    def classify(
        self,
        scope: str,
        items: Sequence[ClassifyItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "CLASSIFY",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            limit if limit is not None else -1,
        ]

        for idx, threshold, features in items:
            arguments.extend([idx, threshold])
            arguments.extend(self._build_signature_arguments(features))

        return self._as_search_result(
            cast("list[tuple[bytes | str, Sequence[float]]]", self.__index(scope, arguments))
        )

    def compare(
        self,
        scope: str,
        key: str,
        items: Sequence[CompareItem],
        limit: int | None = None,
        timestamp: int | None = None,
    ) -> list[SearchResult]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "COMPARE",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            limit if limit is not None else -1,
            key,
        ]

        for idx, threshold in items:
            arguments.extend([idx, threshold])

        return self._as_search_result(
            cast("list[tuple[bytes | str, Sequence[float]]]", self.__index(scope, arguments))
        )

    def record(
        self,
        scope: str,
        key: str,
        items: Sequence[RecordItem],
        timestamp: int | None = None,
    ) -> object:
        if not items:
            return None  # nothing to do

        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "RECORD",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            key,
        ]

        for idx, features in items:
            arguments.append(idx)
            arguments.extend(self._build_signature_arguments(features))

        return self.__index(scope, arguments)

    def merge(
        self,
        scope: str,
        destination: str,
        items: Sequence[IndexItem],
        timestamp: int | None = None,
    ) -> list[object]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "MERGE",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            destination,
        ]

        for idx, source in items:
            arguments.extend([idx, source])

        return self.__index(scope, arguments)

    def delete(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> list[object]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "DELETE",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.__index(scope, arguments)

    def scan(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> Iterator[tuple[str, list[bytes]]]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "SCAN",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        cursors = {idx: 0 for idx in indices}
        while cursors:
            requests: list[list[object]] = []
            for index_key, cursor in cursors.items():
                requests.append([index_key, cursor, batch])

            responses = cast(
                "list[tuple[int, list[bytes]]]",
                self.__index(scope, arguments + flatten(requests)),
            )

            for (idx, _, _), (cursor, chunk) in zip(requests, responses):
                index_key = cast(str, idx)
                cursor = int(cursor)
                if cursor == 0:
                    del cursors[index_key]
                else:
                    cursors[index_key] = cursor

                yield index_key, chunk

    def flush(
        self,
        scope: str,
        indices: Sequence[str],
        batch: int = 1000,
        timestamp: int | None = None,
    ) -> None:
        for index, chunk in self.scan(scope, indices, batch, timestamp):
            if chunk:
                self.cluster.delete(*chunk)

    def export(
        self, scope: str, items: Sequence[IndexItem], timestamp: int | None = None
    ) -> list[object]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "EXPORT",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.__index(scope, arguments)

    def import_(
        self, scope: str, items: Sequence[ImportItem], timestamp: int | None = None
    ) -> list[object]:
        if timestamp is None:
            timestamp = int(time.time())

        arguments: list[object] = [
            "IMPORT",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        for idx, key, data in items:
            arguments.extend([idx, key, data])

        return self.__index(scope, arguments)
