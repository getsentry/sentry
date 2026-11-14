from __future__ import annotations

import itertools
import logging
from collections.abc import Callable, Mapping, Sequence
from typing import TYPE_CHECKING, Protocol, cast

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Frame
from sentry.similarity.backends.abstract import AbstractIndexBackend
from sentry.similarity.encoder import Encoder

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.project import Project
    from sentry.services.eventstore.models import Event

logger = logging.getLogger("sentry.similarity")


class FeatureStrategy(Protocol):
    def extract(self, event: Event) -> Sequence[object]: ...


def get_application_chunks(exception: Interface) -> list[list[Frame]]:
    """\
    Filters out system and framework frames from a stacktrace in order to
    better align similar logical application paths. This returns a sequence of
    application code "chunks": blocks of contiguously called application code.
    """
    return [
        list(frames)
        for in_app, frames in itertools.groupby(
            exception.stacktrace.frames, key=lambda frame: frame.in_app
        )
        if in_app
    ]


class InterfaceDoesNotExist(KeyError):
    pass


class ExceptionFeature:
    def __init__(self, function: Callable[[Interface], Sequence[object]]) -> None:
        self.function = function

    def extract(self, event: Event) -> Sequence[object]:
        try:
            interface = event.interfaces["exception"]
        except KeyError:
            raise InterfaceDoesNotExist()
        return self.function(interface.values[0])


class MessageFeature:
    def __init__(self, function: Callable[[Interface], Sequence[object]]) -> None:
        self.function = function

    def extract(self, event: Event) -> Sequence[object]:
        try:
            interface = event.interfaces["logentry"]
        except KeyError:
            raise InterfaceDoesNotExist()
        return self.function(interface)


class FeatureSet:
    def __init__(
        self,
        index: AbstractIndexBackend,
        encoder: Encoder,
        aliases: Mapping[str, str],
        features: Mapping[str, FeatureStrategy],
        expected_extraction_errors: tuple[type[BaseException], ...],
        expected_encoding_errors: tuple[type[BaseException], ...],
    ) -> None:
        self.index = index
        self.encoder = encoder
        self.aliases = aliases
        self.features = features
        self.expected_extraction_errors = expected_extraction_errors
        self.expected_encoding_errors = expected_encoding_errors
        assert set(self.aliases) == set(self.features)

    def __get_scope(self, project: Project) -> str:
        return f"{project.id}"

    def __get_key(self, group: Group) -> str:
        return f"{group.id}"

    def extract(self, event: Event) -> dict[str, Sequence[object]]:
        results: dict[str, Sequence[object]] = {}
        for label, strategy in self.features.items():
            try:
                results[label] = strategy.extract(event)
            except Exception as error:
                log = (
                    logger.debug
                    if isinstance(error, self.expected_extraction_errors)
                    else logger.warning
                )
                log(
                    "Could not extract features from %r for %r due to error: %r",
                    event,
                    label,
                    error,
                    exc_info=True,
                )
        return results

    def record(self, events: Sequence[Event]) -> object:
        if not events:
            return []

        scope: str | None = None
        key: str | None = None

        items: list[tuple[str, list[bytes]]] = []
        for event in events:
            if not event.group_id:
                continue
            for label, features in self.extract(event).items():
                if scope is None:
                    scope = self.__get_scope(event.project)
                else:
                    assert self.__get_scope(event.project) == scope, (
                        "all events must be associated with the same project"
                    )

                if key is None:
                    key = self.__get_key(cast("Group", event.group))
                else:
                    assert self.__get_key(cast("Group", event.group)) == key, (
                        "all events must be associated with the same group"
                    )

                try:
                    encoded_features = [self.encoder.dumps(feature) for feature in features]
                except Exception as error:
                    log = (
                        logger.debug
                        if isinstance(error, self.expected_encoding_errors)
                        else logger.warning
                    )
                    log(
                        "Could not encode features from %r for %r due to error: %r",
                        event,
                        label,
                        error,
                        exc_info=True,
                    )
                else:
                    if encoded_features:
                        items.append((self.aliases[label], encoded_features))

        return self.index.record(
            cast(str, scope), cast(str, key), items, timestamp=int(event.datetime.timestamp())
        )

    def classify(
        self,
        events: Sequence[Event],
        limit: int | None = None,
        thresholds: Mapping[str, float] | None = None,
    ) -> list[tuple[int, dict[str, float | int | None]]]:
        if not events:
            return []

        if thresholds is None:
            thresholds = {}

        scope: str | None = None

        labels: list[str] = []
        items: list[tuple[str, float, list[bytes]]] = []
        for event in events:
            for label, features in self.extract(event).items():
                if scope is None:
                    scope = self.__get_scope(event.project)
                else:
                    assert self.__get_scope(event.project) == scope, (
                        "all events must be associated with the same project"
                    )

                try:
                    encoded_features = [self.encoder.dumps(feature) for feature in features]
                except Exception as error:
                    log = (
                        logger.debug
                        if isinstance(error, self.expected_encoding_errors)
                        else logger.warning
                    )
                    log(
                        "Could not encode features from %r for %r due to error: %r",
                        event,
                        label,
                        error,
                        exc_info=True,
                    )
                else:
                    if encoded_features:
                        items.append(
                            (self.aliases[label], thresholds.get(label, 0), encoded_features)
                        )
                        labels.append(label)

        return [
            (int(key), dict(zip(labels, scores)))
            for key, scores in self.index.classify(
                cast(str, scope),
                items,
                limit=limit,
                timestamp=int(event.datetime.timestamp()),
            )
        ]

    def compare(
        self,
        group: Group,
        limit: int | None = None,
        thresholds: Mapping[str, float] | None = None,
    ) -> list[tuple[int, dict[str, float | int | None]]]:
        if thresholds is None:
            thresholds = {}

        features = list(self.features.keys())

        items = [(self.aliases[label], thresholds.get(label, 0)) for label in features]

        return [
            (int(key), dict(zip(features, scores)))
            for key, scores in self.index.compare(
                self.__get_scope(group.project), self.__get_key(group), items, limit=limit
            )
        ]

    def merge(
        self, destination: Group, sources: Sequence[Group], allow_unsafe: bool = False
    ) -> None:
        def add_index_aliases_to_key(key: str) -> list[tuple[str, str]]:
            return [(self.aliases[label], key) for label in self.features.keys()]

        # Collect all of the sources by the scope that they are contained
        # within so that we can make the most efficient queries possible and
        # reject queries that cross scopes if we haven't explicitly allowed
        # unsafe actions.
        scopes: dict[str, set[Group]] = {}
        for source in sources:
            scopes.setdefault(self.__get_scope(source.project), set()).add(source)

        unsafe_scopes = set(scopes.keys()) - {self.__get_scope(destination.project)}
        if unsafe_scopes and not allow_unsafe:
            raise ValueError(
                "all groups must belong to same project if unsafe merges are not allowed"
            )

        destination_scope = self.__get_scope(destination.project)
        destination_key = self.__get_key(destination)

        for source_scope, scoped_sources in scopes.items():
            items: list[tuple[str, str]] = []
            for source in scoped_sources:
                items.extend(add_index_aliases_to_key(self.__get_key(source)))

            if source_scope != destination_scope:
                imports = [
                    (alias, destination_key, data)
                    for (alias, _), data in zip(items, self.index.export(source_scope, items))
                ]
                self.index.delete(source_scope, items)
                self.index.import_(destination_scope, imports)
            else:
                self.index.merge(destination_scope, destination_key, items)

    def delete(self, group: Group) -> object:
        key = self.__get_key(group)
        return self.index.delete(
            self.__get_scope(group.project),
            [(self.aliases[label], key) for label in self.features.keys()],
        )

    def flush(self, project: Project) -> None:
        return self.index.flush(self.__get_scope(project), list(self.aliases.values()))
