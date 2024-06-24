from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.transformation.base import QueryResultsTransformer
from sentry.utils.outcomes import Outcome


@dataclass(frozen=True)
class MetricsOutcomesResult:
    series: Sequence[Mapping[str, Any]]
    totals: Sequence[Mapping[str, Any]]


class MetricsOutcomesTransformer(QueryResultsTransformer[Mapping[str, Any]]):
    def transform_result(self, result: Sequence[Mapping[str, Any]]) -> Sequence[Mapping[str, Any]]:
        ret_val = []

        for item in result:
            ret_val_item = {}
            for key in item:
                if key == "outcome.id":
                    outcome = int(item[key])
                    ret_val_item["outcome"] = Outcome(outcome).api_name()
                elif key in "aggregate_value":
                    ret_val_item["quantity"] = item[key]
                else:
                    ret_val_item[key] = item[key]

            ret_val.append(ret_val_item)

        return ret_val

    def transform(self, query_results: Sequence[QueryResult]) -> Mapping[str, Any]:
        """
        Transforms the query results into the format returned by outcomes queries.
        Performs necessary mappings to match that format such as outcome.id -> outcome

        """

        if not query_results or len(query_results) == 0:
            return {"series": [], "totals": []}

        series = self.transform_result(query_results[0].series)
        totals = self.transform_result(query_results[0].totals)

        return {"series": series, "totals": totals}
