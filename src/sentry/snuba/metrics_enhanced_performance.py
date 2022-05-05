from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.snuba import discover
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.snuba.metrics_performance import timeseries_query as metrics_timeseries_query
from sentry.utils.snuba import SnubaTSResult


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
    metrics_compatible = not equations or dry_run

    if metrics_compatible:
        try:
            return metrics_query(
                selected_columns,
                query,
                params,
                equations,
                orderby,
                offset,
                limit,
                referrer,
                auto_fields,
                auto_aggregations,
                use_aggregate_conditions,
                allow_metric_aggregates,
                conditions,
                functions_acl,
                dry_run,
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

    # Either metrics failed, or this isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
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
            functions_acl=functions_acl,
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
            return metrics_timeseries_query(
                selected_columns,
                query,
                params,
                rollup,
                referrer,
                zerofill_results,
                allow_metric_aggregates,
                comparison_delta,
                functions_acl,
                dry_run,
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
