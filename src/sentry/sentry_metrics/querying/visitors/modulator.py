from collections.abc import Sequence

from snuba_sdk import Formula

from sentry.models.project import Project


class ModulationMetadata:
    def __init__(self, from_key: str, to_key: str, from_value: str, to_value: str):
        self.from_key = from_key
        self.to_key = to_key
        self.from_value = from_value
        self.to_value = to_value


class Modulator:
    def __init__(self, from_key: str, to_key: str):
        self.from_key = from_key
        self.to_key = to_key

    def modulate(
        self, formula: Formula, projects: Sequence[Project]
    ) -> tuple[ModulationMetadata, Formula]:
        return formula
