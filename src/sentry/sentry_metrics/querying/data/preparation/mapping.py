from collections.abc import Sequence
from dataclasses import replace

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.mapping.base import MapperConfig
from sentry.sentry_metrics.querying.data.preparation.base import IntermediateQuery, PreparationStep
from sentry.sentry_metrics.querying.visitors.query_expression import MapperVisitor


class QueryMappingStep(PreparationStep):
    def __init__(self, projects: Sequence[Project], mapper_config: MapperConfig):
        self.projects = projects
        self.mapper_config = mapper_config

    def _get_mapped_intermediate_query(
        self, intermediate_query: IntermediateQuery
    ) -> IntermediateQuery:
        visitor = MapperVisitor(self.projects, self.mapper_config)
        mapped_query = visitor.visit(intermediate_query.metrics_query.query)

        return replace(
            intermediate_query,
            metrics_query=intermediate_query.metrics_query.set_query(mapped_query),
            mappers=visitor.mappers,
        )

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        mapped_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            mapped_intermediate_queries.append(
                self._get_mapped_intermediate_query(intermediate_query)
            )

        return mapped_intermediate_queries
