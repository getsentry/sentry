from collections.abc import Mapping, Sequence
from typing import Any

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.modulation.modulator import Modulator
from sentry.sentry_metrics.querying.data.postprocessing.base import PostProcessingStep


class QueryDemodulationStep(PostProcessingStep):
    def __init__(
        self,
        projects: Sequence[Project],
        modulators: Sequence[Modulator],
        value_map: dict[Any, Any],
    ):
        self.projects = projects
        self.modulators = modulators
        self.value_map = value_map

    def run(self, query_results: list[QueryResult]) -> list[QueryResult]:
        for query_result in query_results:
            if query_result.totals:
                query_result.totals = self._demodulate_data(
                    query_result.totals, query_result.totals_query.modulators
                )
            if query_result.series:
                query_result.series = self._demodulate_data(
                    query_result.series, query_result.series_query.modulators
                )

        return query_results

    def _demodulate_data(
        self, data: Sequence[Mapping[str, Any]], modulators: list[Modulator]
    ) -> Sequence[Mapping[str, Any]]:
        for element in data:
            updated_element = dict()
            keys_to_delete = []
            for result_key in element.keys():
                for modulator in modulators:
                    if modulator.to_key == result_key:
                        original_value = modulator.demodulate(
                            self.projects, self.value_map, element[result_key]
                        )
                        updated_element[modulator.from_key] = original_value
                        keys_to_delete.append(result_key)

            for key in keys_to_delete:
                del element[key]
            element.update(updated_element)

        return data
