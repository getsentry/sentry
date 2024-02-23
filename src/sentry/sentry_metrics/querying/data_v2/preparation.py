from dataclasses import dataclass, replace

from snuba_sdk import MetricsQuery, Timeseries

from sentry.sentry_metrics.querying.data_v2.plan import QueryOrder
from sentry.sentry_metrics.querying.data_v2.units import (
    MeasurementUnit,
    UnitFamily,
    get_unit_family_and_unit,
)
from sentry.snuba.metrics import parse_mri


@dataclass(frozen=True)
class IntermediateQuery:
    metrics_query: MetricsQuery
    order: QueryOrder | None = None
    limit: int | None = None
    unit_family: UnitFamily | None = None
    unit: MeasurementUnit | None = None


def normalize_units(intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
    # TODO: check if we want to return an actual new list.
    for index, intermediate_query in enumerate(intermediate_queries):
        metrics_query = intermediate_query.metrics_query
        # For now, we want to perform units coercion only if the query is a timeseries.
        if isinstance(metrics_query.query, Timeseries):
            parsed_mri = parse_mri(metrics_query.query.metric.mri)
            if parsed_mri is not None:
                unit_family_and_unit = get_unit_family_and_unit(parsed_mri.unit)
                if unit_family_and_unit is not None:
                    unit_family, unit = unit_family_and_unit
                    intermediate_queries[index] = replace(
                        intermediate_query,
                        metrics_query=metrics_query.set_query(
                            unit.apply_on_timeseries(metrics_query.query)
                        ),
                        unit_family=unit_family,
                        unit=unit.name,
                    )

    return intermediate_queries
