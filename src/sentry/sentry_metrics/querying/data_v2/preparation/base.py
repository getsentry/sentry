from abc import ABC, abstractmethod
from dataclasses import dataclass

from snuba_sdk import MetricsQuery

from sentry.sentry_metrics.querying.types import QueryOrder
from sentry.sentry_metrics.querying.units import MeasurementUnit, UnitFamily


@dataclass(frozen=True)
class IntermediateQuery:
    metrics_query: MetricsQuery
    order: QueryOrder | None = None
    limit: int | None = None
    unit_family: UnitFamily | None = None
    unit: MeasurementUnit | None = None
    scaling_factor: float | None = None


class PreparationStep(ABC):
    @abstractmethod
    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        raise NotImplementedError


def run_preparation_steps(
    intermediate_queries: list[IntermediateQuery], *steps
) -> list[IntermediateQuery]:
    for step in steps:
        if isinstance(step, PreparationStep):
            intermediate_queries = step.run(intermediate_queries=intermediate_queries)

    return intermediate_queries
