from dataclasses import replace

from sentry.sentry_metrics.querying.data_v2.preparation.base import (
    IntermediateQuery,
    PreparationStep,
)
from sentry.sentry_metrics.querying.units import WithUnit
from sentry.sentry_metrics.querying.visitors import UnitsNormalizationV2Visitor


class UnitNormalizationStep(PreparationStep):
    """
    Represents a step which performs unit normalization on a collection of intermediate queries.

    Unit normalization refers to the process of making sure all components of a query have the values on the same
    scale. For example, if you have 100 ms * 100 s the normalization will convert it to 100 ms * 100000 ms.
    """

    def _get_normalized_intermediate_query(
        self, intermediate_query: IntermediateQuery
    ) -> IntermediateQuery:
        """
        Computes the unit normalized query from an IntermediateQuery using a units normalization visitor.

        Returns:
            If the unit metadata returned by the visitor has a unit, the transformed intermediate query will be returned
            , otherwise the supplied intermediate query will be returned.
        """
        units_normalization = UnitsNormalizationV2Visitor()
        # We compute the new normalized query by visiting and mutating the expression tree.
        unit_metadata, normalized_query = units_normalization.visit(
            intermediate_query.metrics_query.query
        )
        if isinstance(unit_metadata, WithUnit):
            return replace(
                intermediate_query,
                metrics_query=intermediate_query.metrics_query.set_query(normalized_query),
                unit_family=unit_metadata.unit_family,
                unit=unit_metadata.reference_unit,
                scaling_factor=unit_metadata.scaling_factor,
            )

        return intermediate_query

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        normalized_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            normalized_intermediate_queries.append(
                self._get_normalized_intermediate_query(intermediate_query)
            )

        return normalized_intermediate_queries
