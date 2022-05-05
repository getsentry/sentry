from datetime import timedelta
from typing import Any, Dict, List, Optional, Sequence

import sentry_sdk
from snuba_sdk import AliasedExpression

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events.builder import MetricsQueryBuilder, TimeseriesMetricQueryBuilder
from sentry.sentry_metrics import indexer
from sentry.snuba import discover
from sentry.utils.snuba import SnubaTSResult


def resolve_tags(results: Any, query_definition: MetricsQueryBuilder) -> Any:
    """Go through the results of a metrics query and reverse resolve its tags"""
    tags: List[str] = []

    with sentry_sdk.start_span(op="mep", description="resolve_tags"):
        for column in query_definition.columns:
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
    allow_metric_aggregates=True,
    conditions=None,
    functions_acl=None,
    dry_run=False,
):
    with sentry_sdk.start_span(op="mep", description="MetricQueryBuilder"):
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
            allow_metric_aggregates=allow_metric_aggregates,
            functions_acl=functions_acl,
            limit=limit,
            offset=offset,
            dry_run=dry_run,
        )
        if dry_run:
            metrics_referrer = referrer + ".dry-run"
        else:
            metrics_referrer = referrer + ".metrics-enhanced"
        results = metrics_query.run_query(metrics_referrer)
        if dry_run:
            # Query has to reach here to be considered compatible
            sentry_sdk.set_tag("query.mep_compatible", True)
            return {}
    with sentry_sdk.start_span(op="mep", description="query.transform_results"):
        results = discover.transform_results(results, metrics_query.function_alias_map, {}, None)
        results = resolve_tags(results, metrics_query)
        results["meta"]["isMetricsData"] = True
        sentry_sdk.set_tag("performance.dataset", "metrics")
        return results


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, str],
    rollup: int,
    referrer: str,
    zerofill_results: bool = True,
    allow_metric_aggregates=True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[List[str]] = None,
    dry_run: bool = False,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_compatible = False
    equations, columns = categorize_columns(selected_columns)
    if comparison_delta is None and not equations:
        metrics_compatible = True

    if metrics_compatible or dry_run:
        try:
            with sentry_sdk.start_span(op="mep", description="TimeseriesMetricQueryBuilder"):
                metrics_query = TimeseriesMetricQueryBuilder(
                    params,
                    rollup,
                    query=query,
                    selected_columns=columns,
                    functions_acl=functions_acl,
                    allow_metric_aggregates=allow_metric_aggregates,
                    dry_run=dry_run,
                )
                if dry_run:
                    metrics_referrer = referrer + ".dry-run"
                else:
                    metrics_referrer = referrer + ".metrics-enhanced"
                result = metrics_query.run_query(metrics_referrer)
                if dry_run:
                    # Query has to reach here to be considered compatible
                    sentry_sdk.set_tag("query.mep_compatible", True)
                    return
            with sentry_sdk.start_span(op="mep", description="query.transform_results"):
                result = discover.transform_results(
                    result, metrics_query.function_alias_map, {}, None
                )
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
                sentry_sdk.set_tag("performance.dataset", "metrics")
                return SnubaTSResult(
                    {"data": result["data"], "isMetricsData": True},
                    params["start"],
                    params["end"],
                    rollup,
                )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            if not dry_run:
                raise error
            else:
                sentry_sdk.set_tag("performance.mep_incompatible", str(error))
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False
        except Exception as error:
            if dry_run:
                return
            else:
                raise error

    if dry_run:
        return {}

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
        return discover.timeseries_query(
            selected_columns,
            query,
            params,
            rollup,
            referrer,
            zerofill_results,
            comparison_delta,
            functions_acl,
        )
    return SnubaTSResult()
