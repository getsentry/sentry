from abc import ABC, abstractmethod
from dataclasses import dataclass, replace

from snuba_sdk import MetricsQuery, Timeseries

from sentry.sentry_metrics.querying.data_v2.units import (
    MeasurementUnit,
    UnitFamily,
    get_unit_family_and_unit,
)
from sentry.sentry_metrics.querying.types import QueryOrder
from sentry.snuba.metrics import parse_mri


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


class UnitNormalizationStep(PreparationStep):

    EXCLUDED_AGGREGATES = {"count", "count_unique"}

    def _extract_unit(self, timeseries: Timeseries) -> str | None:
        # If the aggregate doesn't support unit normalization, we will skip it.
        if timeseries.aggregate in self.EXCLUDED_AGGREGATES:
            return None

        parsed_mri = parse_mri(timeseries.metric.mri)
        if parsed_mri is not None:
            return parsed_mri.unit

        return None

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        normalized_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            normalized_intermediate_query = intermediate_query
            metrics_query = intermediate_query.metrics_query
            # For now, we want to perform units coercion only if the query is a timeseries.
            if isinstance(metrics_query.query, Timeseries):
                extracted_unit = self._extract_unit(timeseries=metrics_query.query)
                if extracted_unit is not None:
                    unit_family_and_unit = get_unit_family_and_unit(extracted_unit)
                    if unit_family_and_unit is not None:
                        (
                            unit_family,
                            reference_unit,
                            unit,
                        ) = unit_family_and_unit
                        normalized_intermediate_query = replace(
                            intermediate_query,
                            metrics_query=metrics_query.set_query(
                                unit.apply_on_timeseries(metrics_query.query)
                            ),
                            unit_family=unit_family,
                            unit=reference_unit,
                            scaling_factor=unit.scaling_factor,
                        )

            normalized_intermediate_queries.append(normalized_intermediate_query)

        return normalized_intermediate_queries
