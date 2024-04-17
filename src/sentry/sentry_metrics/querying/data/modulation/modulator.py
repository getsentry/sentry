import abc
from collections.abc import Sequence

from snuba_sdk import Formula

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.modulation.modulation_value_map import (
    QueryModulationValueMap,
)


class Modulator(abc.ABC):
    def __init__(self, from_key: str, to_key: str):
        self.from_key = from_key
        self.to_key = to_key

    def __hash__(self):
        return hash((self.from_key, self.to_key))

    @abc.abstractmethod
    def modulate(
        self,
        projects: Sequence[Project],
        value_map: QueryModulationValueMap,
        formula: Formula,
        **kwargs,
    ) -> Formula:
        return formula

    @abc.abstractmethod
    def demodulate(
        self,
        projects: Sequence[Project],
        value_map: QueryModulationValueMap,
        formula: Formula,
        **kwargs,
    ) -> Formula:
        return formula


class Project2ProjectIDModulator(Modulator):
    def __init__(self, from_key: str = "project", to_key: str = "project_id"):
        self.from_key = from_key
        self.to_key = to_key

    def modulate(
        self,
        projects: Sequence[Project],
        value_map: QueryModulationValueMap,
        formula: Formula,
    ) -> Formula:
        if formula not in value_map:
            value_map[formula] = None
            for project in projects:
                if project.slug == formula:
                    value_map[formula] = project.id
        return value_map[formula]

    def demodulate(
        self,
        projects: Sequence[Project],
        value_map: QueryModulationValueMap,
        formula: Formula,
    ) -> Formula:
        if formula not in value_map:
            for project in projects:
                if project.id == formula:
                    value_map[formula] = project.slug

        return value_map[formula]


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
