import abc
from collections.abc import Sequence

from snuba_sdk import Formula

from sentry.models.project import Project
from sentry.sentry_metrics.querying.visitors.query_modulator import ModulationMetadata


class Modulator(abc.ABC):
    def __init__(self, from_key: str, to_key: str, from_value: str):
        self.from_key = from_key
        self.to_key = to_key
        self.from_value = from_value

    def modulate(
        self, formula: Formula, projects: Sequence[Project]
    ) -> tuple[ModulationMetadata, Formula]:
        return formula
