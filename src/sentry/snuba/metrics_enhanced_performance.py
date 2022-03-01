from datetime import timedelta
from typing import Dict, List, Optional, Sequence

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events.builder import TimeseriesMetricQueryBuilder
from sentry.snuba import discover
from sentry.utils.snuba import SnubaTSResult


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, str],
    rollup: int,
    referrer: str,
    zerofill_results: bool = True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[List[str]] = None,
    use_snql: Optional[bool] = False,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_compatible = False
    equations, columns = categorize_columns(selected_columns)
    if comparison_delta is None and not equations:
        metrics_compatible = True

    if metrics_compatible:
        try:
            metrics_query = TimeseriesMetricQueryBuilder(
                params,
                rollup,
                query=query,
                selected_columns=columns,
                functions_acl=functions_acl,
            )
            result = metrics_query.run_query(referrer + ".metrics-enhanced")
            result = discover.transform_results(result, metrics_query.function_alias_map, {}, None)
            result["data"] = (
                discover.zerofill(
                    result["data"],
                    params["start"],
                    params["end"],
                    rollup,
                    "time",
                )
                if zerofill_results
                else result["data"]
            )
            return SnubaTSResult(
                {"data": result["data"], "isMetricsData": True},
                params["start"],
                params["end"],
                rollup,
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            raise error
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery:
            metrics_compatible = False

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        return discover.timeseries_query(
            selected_columns,
            query,
            params,
            rollup,
            referrer,
            zerofill_results,
            comparison_delta,
            functions_acl,
            use_snql,
        )
    return SnubaTSResult()
