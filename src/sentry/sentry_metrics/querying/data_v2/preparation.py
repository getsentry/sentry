from snuba_sdk import Timeseries

from sentry.sentry_metrics.querying.data_v2.api import IntermediateQuery
from sentry.snuba.metrics import parse_mri

# 1. Compute for each unit its family and scaling factor
# 2. For each unit group iterate over the queries and apply `Formula(multiply, [query, scaling_factor])
# 3. Figure out how to propagate metadata of the unit queried


def normalize_units(intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
    seen_units = set()
    for intermediate_query in intermediate_queries:
        query = intermediate_query.metrics_query.query
        if isinstance(query, Timeseries):
            parsed_mri = parse_mri(query.metric.mri)
            if parsed_mri is not None:
                seen_units.add(parsed_mri.unit)
