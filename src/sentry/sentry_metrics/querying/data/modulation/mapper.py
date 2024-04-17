import abc
from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sentry.models.project import Project


class Mapper(abc.ABC):
    from_key: str = ""
    to_key: str = ""

    def __init__(self):
        self.map: dict[Any, Any] = {}

    def __hash__(self):
        return hash((self.from_key, self.to_key))

    @abc.abstractmethod
    def forward(self, projects: Sequence[Project], value: Any) -> Any:
        return value

    @abc.abstractmethod
    def backward(self, projects: Sequence[Project], value: Any) -> Any:
        return value


TMapper = TypeVar("TMapper", bound=Mapper)


class MapperConfig:
    def __init__(self):
        self.mappers: set[Generic[TMapper]] = set()

    def add(self, mapper: Generic[TMapper]) -> "MapperConfig":
        self.mappers.add(mapper)
        return self

    def get(self, from_key: str | None = None, to_key: str | None = None) -> type[Mapper] | None:
        for mapper in self.mappers:
            if mapper.from_key == from_key:
                return mapper
            if mapper.to_key == to_key:
                return mapper
        return None


class Project2ProjectIDMapper(Mapper):
    from_key: str = "project"
    to_key: str = "project_id"

    def __init__(self):
        super().__init__()

    def forward(self, projects: Sequence[Project], value: str) -> int:
        if value not in self.map:
            self.map[value] = None
            for project in projects:
                if project.slug == value:
                    self.map[value] = project.id
        return self.map[value]

    def backward(self, projects: Sequence[Project], value: int) -> str:
        if value not in self.map:
            for project in projects:
                if project.id == value:
                    self.map[value] = project.slug

        return self.map[value]


def find_modulator(
    modulators: Sequence[Mapper], from_key: str | None = None, to_key: str | None = None
) -> Mapper | None:
    for modulator in modulators:
        if from_key:
            if modulator.from_key == from_key:
                return modulator
        if to_key:
            if modulator.to_key == to_key:
                return modulator

    return None
