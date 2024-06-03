from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from snuba_sdk import MetricsQuery

from sentry.sentry_metrics.querying.data.mapping.base import Mapper
from sentry.sentry_metrics.querying.types import QueryOrder
from sentry.sentry_metrics.querying.units import MeasurementUnit, UnitFamily


@dataclass(frozen=True)
class IntermediateQuery:
    """
    Represents an intermediate query that can be run through a series of immutable transformations.

    Attributes:
        metrics_query: The query that needs to be run.
        order: The order of the groups that are returned.
        limit: The maximum number of groups to return.
        unit_family: The UnitFamily of the query.
        unit: The unit of the query.
        scaling_factor: The scaling factor that was applied on the query to normalize it to unit.
    """

    metrics_query: MetricsQuery
    order: QueryOrder | None = None
    limit: int | None = None
    unit_family: UnitFamily | None = None
    unit: MeasurementUnit | None = None
    scaling_factor: float | None = None
    mappers: list[Mapper] = field(default_factory=list)


class PreparationStep(ABC):
    """
    Represents an abstract step that prepares a collection of IntermediateQuery objects.

    The preparation of these objects might include transforming them or just obtaining some intermediate data that is
    useful to compute other things before executing the query.
    """

    @abstractmethod
    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        """
        Runs the preparation steps on a list of intermediate queries.

        Returns:
            A list of intermediate queries.
        """
        raise NotImplementedError


def run_preparation_steps(
    intermediate_queries: list[IntermediateQuery], *steps
) -> list[IntermediateQuery]:
    """
    Takes a series of intermediate queries and steps and runs those intermediate queries on the supplied steps in an
    accumulating way.

    Returns:
        A list of intermediate queries after running the preparation steps.
    """
    for step in steps:
        if isinstance(step, PreparationStep):
            intermediate_queries = step.run(intermediate_queries=intermediate_queries)

    return intermediate_queries
