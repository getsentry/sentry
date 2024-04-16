from collections.abc import Mapping, Sequence
from typing import Any

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.postprocessing.base import PostProcessingStep
from sentry.sentry_metrics.querying.visitors.modulator import Modulator


class QueryDemodulationStep(PostProcessingStep):
    def __init__(self, projects: Sequence[Project], modulators: Sequence[Modulator]):
        self.projects = projects
        self.modulators = modulators

    def run(self, query_results: list[QueryResult]) -> list[QueryResult]:
        for query_result in query_results:
            if hasattr(query_result, "totals"):
                query_result.totals = self._demodulate_data(query_result.totals)
            if hasattr(query_result, "series"):
                query_result.series = self._demodulate_data(query_result.series)

            # query_result.group_bys = self._demodulate_groupbys(query_result.group_bys)

        return query_results

    def _demodulate_data(self, data: Sequence[Mapping[str, Any]]) -> Sequence[Mapping[str, Any]]:
        for element in data:
            updated_element = dict()
            keys_to_delete = []
            for result_key in element.keys():
                for modulator in self.modulators:
                    if modulator.to_key == result_key:
                        original_value = modulator.demodulate(result_key, self.projects)
                        updated_element[modulator.from_key] = original_value
                        keys_to_delete.append(result_key)

            for key in keys_to_delete:
                del element[key]
            element.update(updated_element)

        return data

    def _demodulate_groupbys(self, group_bys: list[str]) -> list[str]:
        for idx, group in enumerate(group_bys):
            for modulator in self.modulators:
                group_bys[idx] = modulator.demodulate(group, self.projects)

        return group_bys
