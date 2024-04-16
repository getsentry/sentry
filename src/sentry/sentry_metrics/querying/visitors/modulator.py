import abc
from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from snuba_sdk import Formula

from sentry.models.project import Project


class ModulationMetadata:
    def __init__(self, from_key: str, to_key: str, from_value: str, to_value: str):
        self.from_key = from_key
        self.to_key = to_key
        self.from_value = from_value
        self.to_value = to_value


class Modulator(abc.ABC):
    def __init__(self, from_key: str, to_key: str):
        self.from_key = from_key
        self.to_key = to_key
        self.value_map: dict[Any, Any] = defaultdict(lambda: None)

    def __hash__(self):
        return hash((self.from_key, self.to_key))

    @abc.abstractmethod
    def modulate(self, formula: Formula, **kwargs) -> tuple[ModulationMetadata, Formula]:
        return formula

    @abc.abstractmethod
    def demodulate(self, formula: Formula, **kwargs) -> Formula:
        return formula


class Project2ProjectIDModulator(Modulator):
    def modulate(self, formula: Formula, projects: Sequence[Project]) -> Formula:
        # if no value is stored for this formula, add it to the map, then & otherwise return the existing formula
        # the value should not change for the same key, so we don't re-store in case it is already in there
        if formula not in self.value_map:
            self.value_map[formula] = None
            for project in projects:
                if project.slug == formula:
                    self.value_map[formula] = project.id
        return self.value_map[formula]

    def demodulate(self, formula: Formula, projects: Sequence[Project]) -> Formula:
        if formula not in self.value_map:
            # If the from_value was not set during modulation, e.g. because only a groupby statement was used in the
            # query, retrieve the value mapping on demodulation in order to inject it into the query result.
            for project in projects:
                if project.id == formula:
                    self.value_map[formula] = project.slug

        return self.value_map[formula]
