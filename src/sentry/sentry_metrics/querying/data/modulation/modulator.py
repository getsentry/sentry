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
    def modulate(self, projects: Sequence[Project], formula: Formula, **kwargs) -> Formula:
        return formula

    @abc.abstractmethod
    def demodulate(self, projects: Sequence[Project], formula: Formula, **kwargs) -> Formula:
        return formula


class Project2ProjectIDModulator(Modulator):
    def __init__(self, from_key: str = "project", to_key: str = "project_id"):
        self.from_key = from_key
        self.to_key = to_key
        self.value_map: dict[Any, Any] = defaultdict(lambda: None)

    def modulate(self, projects: Sequence[Project], formula: Formula) -> Formula:
        if formula not in self.value_map:
            self.value_map[formula] = None
            for project in projects:
                if project.slug == formula:
                    self.value_map[formula] = project.id
        return self.value_map[formula]

    def demodulate(self, projects: Sequence[Project], formula: Formula) -> Formula:
        if formula not in self.value_map:
            for project in projects:
                if project.id == formula:
                    self.value_map[formula] = project.slug

        return self.value_map[formula]


def find_modulator(
    modulators: Sequence[Modulator], from_key: str | None = None, to_key: str | None = None
) -> Modulator | None:
    for modulator in modulators:
        if from_key:
            if modulator.from_key == from_key:
                return modulator
        if to_key:
            if modulator.to_key == to_key:
                return modulator

    return None
