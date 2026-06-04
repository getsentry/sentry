from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any, cast

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.mapping.base import Mapper
from sentry.sentry_metrics.querying.data.postprocessing.base import PostProcessingStep


class QueryRemappingStep(PostProcessingStep):
    def __init__(self, projects: Sequence[Project]):
        self.projects = projects

    def run(self, query_results: list[QueryResult]) -> list[QueryResult]:
        for query_result in query_results:
            if (
                query_result.totals is not None
                and query_result.totals_query is not None
                and len(query_result.totals) > 0
            ):
                query_result.totals = self._unmap_data(
                    query_result.totals, query_result.totals_query.mappers
                )
            if (
                query_result.series is not None
                and query_result.series_query is not None
                and len(query_result.series) > 0
            ):
                query_result.series = self._unmap_data(
                    query_result.series, query_result.series_query.mappers
                )

        return query_results

    def _unmap_data(
        self, data: Sequence[Mapping[str, Any]], mappers: list[Mapper]
    ) -> Sequence[Mapping[str, Any]]:
        unmapped_data: list[dict[str, Any]] = cast(list[dict[str, Any]], deepcopy(data))
        for element in unmapped_data:
            updated_element = dict()
            keys_to_delete = []
            for result_key in element.keys():
                for mapper in mappers:
                    if mapper.to_key == result_key and mapper.applied_on_groupby:
                        original_value = mapper.backward(self.projects, element[result_key])
                        updated_element[mapper.from_key] = original_value
                        keys_to_delete.append(result_key)

            for key in keys_to_delete:
                del element[key]
            element.update(updated_element)

        return cast(Sequence[Mapping[str, Any]], unmapped_data)
