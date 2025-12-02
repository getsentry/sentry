from collections.abc import Iterator

from sentry.eventtypes.base import BaseEvent


class EventTypeManager:
    def __init__(self) -> None:
        self.__values: list[type[BaseEvent]] = []
        self.__lookup: dict[str, type[BaseEvent]] = {}

    def __iter__(self) -> Iterator[type[BaseEvent]]:
        yield from self.__values

    def __contains__(self, key: str) -> bool:
        return key in self.__lookup

    def get(self, key: str, **kwargs: object) -> type[BaseEvent]:
        return self.__lookup[key]

    def exists(self, key: str) -> bool:
        return key in self.__lookup

    def register(self, cls: type[BaseEvent]) -> None:
        self.__values.append(cls)
        self.__lookup[cls.key] = cls
