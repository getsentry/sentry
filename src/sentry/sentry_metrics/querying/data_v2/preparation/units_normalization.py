from dataclasses import replace

from sentry.sentry_metrics.querying.data_v2.preparation import IntermediateQuery, PreparationStep
from sentry.sentry_metrics.querying.errors import NonNormalizableUnitsError
from sentry.sentry_metrics.querying.visitors import UnitsNormalizationVisitor
from sentry.sentry_metrics.querying.visitors.query_expression import UnitsNormalizationV2Visitor


class UnitNormalizationStep(PreparationStep):
    def _get_normalized_intermediate_query(
        self, intermediate_query: IntermediateQuery
    ) -> IntermediateQuery:
        units_normalization = UnitsNormalizationV2Visitor()
        # We compute the new normalized query by visiting and mutating the expression tree.
        unit_metadata, normalized_query = units_normalization.visit(intermediate_query.metrics_query.query)
        if unit_metadata is None:
            return intermediate_query

        unit_family, reference_unit, unit = unit_metadata
        return replace(
            intermediate_query,
            metrics_query=intermediate_query.metrics_query.set_query(normalized_query),
            unit_family=unit_family,
            unit=reference_unit,
            scaling_factor=unit.scaling_factor if unit is not None else None,
        )

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        normalized_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            normalized_intermediate_queries.append(
                self._get_normalized_intermediate_query(intermediate_query)
            )

        return normalized_intermediate_queries
