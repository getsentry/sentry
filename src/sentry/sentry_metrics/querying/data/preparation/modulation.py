from collections.abc import Sequence
from dataclasses import replace

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.preparation.base import IntermediateQuery, PreparationStep
from sentry.sentry_metrics.querying.visitors.modulator import Modulator
from sentry.sentry_metrics.querying.visitors.query_modulator import ModulatorVisitor


class QueryModulationStep(PreparationStep):
    def __init__(self, projects: Sequence[Project], modulators: list[Modulator]):
        self.projects = projects
        self.modulators = modulators

    def _get_modulated_intermediate_query(
        self, intermediate_query: IntermediateQuery
    ) -> IntermediateQuery:
        # the ModulatorVisitor isn't doing what it should be yet: the modulators, which are enacted on the timeseries of the formula, are not added to the modulators list.
        visitor = ModulatorVisitor(self.projects, self.modulators)
        modulated_query = visitor.visit(intermediate_query.metrics_query.query)
        modulators = visitor.applied_modulators
        if modulators:
            return replace(
                intermediate_query,
                metrics_query=intermediate_query.metrics_query.set_query(modulated_query),
                modulators=modulators,
            )

        return intermediate_query

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        modulated_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            modulated_intermediate_queries.append(
                self._get_modulated_intermediate_query(intermediate_query)
            )

        return modulated_intermediate_queries
