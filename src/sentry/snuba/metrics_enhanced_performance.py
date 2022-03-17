from datetime import timedelta
from typing import Any, Dict, List, Optional, Sequence

from snuba_sdk import AliasedExpression

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events.builder import MetricsQueryBuilder, TimeseriesMetricQueryBuilder
from sentry.sentry_metrics import indexer
from sentry.snuba import discover
from sentry.utils.snuba import SnubaTSResult


def resolve_tags(results: Any, metrics_query: MetricsQueryBuilder) -> Any:
    """Go through the results of a metrics query and reverse resolve its tags"""
    tags: List[str] = []

    for column in metrics_query.columns:
        if (
            isinstance(column, AliasedExpression)
            and column.exp.subscriptable == "tags"
            and column.alias
        ):
            tags.append(column.alias)

    for tag in tags:
        for row in results["data"]:
            row[tag] = indexer.reverse_resolve(row[tag])
        if tag in results["meta"]:
            results["meta"][tag] = "string"

    return results


def query(
    selected_columns,
    query,
    params,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    referrer=None,
    auto_fields=False,
    auto_aggregations=False,
    use_aggregate_conditions=False,
    conditions=None,
    extra_snql_condition=None,
    functions_acl=None,
    use_snql=False,
):
    """ """
    metrics_compatible = not equations

    if metrics_compatible:
        try:
            metrics_query = MetricsQueryBuilder(
                params,
                query=query,
                selected_columns=selected_columns,
                equations=[],
                orderby=orderby,
                # Auto fields will add things like id back in if enabled
                auto_fields=False,
                auto_aggregations=auto_aggregations,
                use_aggregate_conditions=use_aggregate_conditions,
                functions_acl=functions_acl,
                limit=limit,
                offset=offset,
            )
            # Getting the 0th result for now, will need to consolidate multiple query results later
            results = metrics_query.run_query(referrer + ".metrics-enhanced")
            results = discover.transform_results(
                results, metrics_query.function_alias_map, {}, None
            )
            results = resolve_tags(results, metrics_query)
            results["meta"]["isMetricsData"] = True
            return results
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            raise error
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery:
            metrics_compatible = False

    # Either metrics failed, or this isn't a query we can enhance with metrics
    if not metrics_compatible:
        results = discover.query(
            selected_columns,
            query,
            params,
            equations=equations,
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=referrer,
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            conditions=conditions,
            extra_snql_condition=extra_snql_condition,
            functions_acl=functions_acl,
            use_snql=use_snql,
        )
        results["meta"]["isMetricsData"] = False

        return results

    return {}


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
