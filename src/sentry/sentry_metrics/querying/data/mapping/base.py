import abc
from collections.abc import Sequence
from typing import Any

from sentry.models.project import Project


class Mapper(abc.ABC):
    from_key: str = ""
    to_key: str = ""
    applied_on_groupby: bool = False

    def __init__(self):
        # This exists to satisfy mypy, which complains otherwise
        self.map: dict[Any, Any] = {}

    def __hash__(self):
        return hash((self.from_key, self.to_key))

    @abc.abstractmethod
    def forward(self, projects: Sequence[Project], value: Any) -> Any:
        return value

    @abc.abstractmethod
    def backward(self, projects: Sequence[Project], value: Any) -> Any:
        return value


class MapperConfig:
    def __init__(self):
        self.mappers: set[type[Mapper]] = set()

    def add(self, mapper: type[Mapper]) -> "MapperConfig":
        self.mappers.add(mapper)
        return self

    def get(self, from_key: str | None = None, to_key: str | None = None) -> type[Mapper] | None:
        for mapper in self.mappers:
            if mapper.from_key == from_key:
                return mapper
            if mapper.to_key == to_key:
                return mapper
        return None


def get_or_create_mapper(
    mapper_config: MapperConfig,
    mappers: list[Mapper],
    from_key: str | None = None,
    to_key: str | None = None,
) -> Mapper | None:
    # retrieve the mapper type that is applicable for the given key
    mapper_class = mapper_config.get(from_key=from_key, to_key=to_key)
    # check if a mapper of the type already exists
    if mapper_class:
        for mapper in mappers:
            if mapper_class == type(mapper):
                # if a mapper already exists, return the existing mapper
                return mapper
        else:
            # if no mapper exists yet, instantiate the object and append it to the mappers list
            mapper_instance = mapper_class()
            mappers.append(mapper_instance)
            return mapper_instance
    else:
        # if no mapper is configured for the key, return None
        return None
