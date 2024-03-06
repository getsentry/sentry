from dataclasses import replace

from sentry.sentry_metrics.querying.data_v2.preparation import IntermediateQuery, PreparationStep
from sentry.sentry_metrics.querying.errors import NonNormalizableUnitsError
from sentry.sentry_metrics.querying.visitors import UnitsNormalizationVisitor


class UnitNormalizationStep(PreparationStep):
    def _get_normalized_intermediate_query(
        self, intermediate_query: IntermediateQuery
    ) -> IntermediateQuery:
        try:
            units_normalization = UnitsNormalizationVisitor()
            # We compute the new normalized query by visiting and mutating the expression tree.
            normalized_query = units_normalization.visit(intermediate_query.metrics_query.query)
            # We obtain the units that have been used by the visitor.
            (
                unit_family,
                reference_unit,
                scaling_factor,
            ) = units_normalization.get_units_metadata()

            return replace(
                intermediate_query,
                metrics_query=intermediate_query.metrics_query.set_query(normalized_query),
                unit_family=unit_family,
                unit=reference_unit,
                scaling_factor=scaling_factor,
            )
        except NonNormalizableUnitsError:
            return intermediate_query

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        normalized_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            normalized_intermediate_queries.append(
                self._get_normalized_intermediate_query(intermediate_query)
            )

        return normalized_intermediate_queries
