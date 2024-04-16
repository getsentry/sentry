import abc
from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from snuba_sdk import Formula

from sentry.models.project import Project


class Modulator(abc.ABC):
    def __init__(self, from_key: str, to_key: str):
        self.from_key = from_key
        self.to_key = to_key
        self.value_map: dict[Any, Any] = defaultdict(lambda: None)

    def __hash__(self):
        return hash((self.from_key, self.to_key))

    @abc.abstractmethod
    def modulate(self, formula: Formula, **kwargs) -> Formula:
        return formula

    @abc.abstractmethod
    def demodulate(self, formula: Formula, **kwargs) -> Formula:
        return formula


class Project2ProjectIDModulator(Modulator):
    def modulate(self, formula: Formula, projects: Sequence[Project]) -> Formula:
        if formula not in self.value_map:
            self.value_map[formula] = None
            for project in projects:
                if project.slug == formula:
                    self.value_map[formula] = project.id
        return self.value_map[formula]

    def demodulate(self, formula: Formula, projects: Sequence[Project]) -> Formula:
        if formula not in self.value_map:
            for project in projects:
                if project.id == formula:
                    self.value_map[formula] = project.slug

        return self.value_map[formula]
