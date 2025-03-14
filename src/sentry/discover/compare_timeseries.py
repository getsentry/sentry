from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import TypedDict

import sentry_sdk

from sentry import features
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import SnubaParams
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.metrics_performance import timeseries_query
from sentry.snuba.models import SnubaQuery
from sentry.snuba.spans_rpc import run_timeseries_query
from sentry.utils.snuba import SnubaTSResult

WINDOW_TO_INTERVAL_MAP = {
    60: "24h",
    300: "24h",
}


class TSResultForComparison(TypedDict):
    result: SnubaTSResult
    agg_alias: str


def make_rpc_request(
    query: str,
    aggregate: str,
    time_window: int,
    snuba_params: SnubaParams,
) -> TSResultForComparison:
    query = apply_dataset_query_conditions(SnubaQuery.Type.PERFORMANCE, query, None)

    query_parts = QueryParts(selected_columns=[aggregate], query=query, equations=[], orderby=[])
    query_parts = translate_mep_to_eap(query_parts)

    results = run_timeseries_query(
        snuba_params,
        query_string=query_parts["query"],
        y_axes=query_parts["selected_columns"],
        referrer="job-runner.compare-timeseries",
        granularity_secs=time_window,
        config=SearchResolverConfig(),
    )

    return TSResultForComparison(result=results, agg_alias=query_parts["selected_columns"][0])


def make_snql_request(
    query: str,
    aggregate: str,
    time_window: int,
    on_demand_metrics_enabled: bool,
    snuba_params: SnubaParams,
) -> TSResultForComparison:
    query = apply_dataset_query_conditions(SnubaQuery.Type.PERFORMANCE, query, None)

    results = timeseries_query(
        [aggregate],
        query,
        snuba_params=snuba_params,
        rollup=time_window,
        referrer="job-runner.compare-timeseries",
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
        zerofill_results=True,
    )

    return TSResultForComparison(result=results, agg_alias=get_function_alias(aggregate))


def align_timeseries(snql_result: TSResultForComparison, rpc_result: TSResultForComparison):
    aligned_results = defaultdict(lambda: {"rpc_value": None, "snql_value": None})

    def fill_aligned_series(data: SnubaTSResult, alias: str, key: str):
        for element in data["data"]:
            element_value = element.get(alias) or 0
            element_time = element["time"]
            aligned_results[element_time][key] = float(element_value)

    fill_aligned_series(snql_result["result"].data, snql_result["agg_alias"], "snql_value")
    fill_aligned_series(rpc_result["result"].data, rpc_result["agg_alias"], "rpc_value")

    return aligned_results


def assert_timeseries_close(aligned_timeseries):
    mismatches: dict[int, dict[str, float]] = {}
    missing_buckets = 0
    for timestamp, values in aligned_timeseries.items():
        rpc_value = values["rpc_value"]
        snql_value = values["snql_value"]
        if rpc_value is None or snql_value is None:
            missing_buckets += 1
            continue

        # If the sum is 0, we assume that the numbers must be 0, since we have all positive integers. We still do
        # check the sum in order to protect the division by zero in case for some reason we have -x + x inside of
        # the timeseries.
        if rpc_value + snql_value == 0:
            continue

        mismatch = abs(rpc_value - snql_value)
        average = (rpc_value + snql_value) / 2
        diff = mismatch / average

        if diff > 0.05:
            mismatches[timestamp] = {
                "rpc_value": rpc_value,
                "snql_value": snql_value,
                "mismatch_percentage": mismatch,
            }

    if mismatches:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("mismatches", mismatches)
            sentry_sdk.capture_message("Timeseries mismatch", level="info")

    if missing_buckets > 1:
        sentry_sdk.capture_message("Multiple missing buckets!", level="info")

    return mismatches


def compare_timeseries_for_alert_rule(alert_rule: AlertRule):
    snuba_query: SnubaQuery = alert_rule.snuba_query
    project = alert_rule.projects.first()
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    on_demand_metrics_enabled = features.has(
        "organizations:on-demand-metrics-extraction",
        organization,
    )

    # Align time to the nearest hour because RPCs roll up on exact timestamps.
    now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    snuba_params = SnubaParams(
        environments=[snuba_query.environment],
        projects=[project],
        organization=organization,
        start=now - timedelta(days=1),
        end=now,
    )

    rpc_result = make_rpc_request(
        snuba_query.query,
        snuba_query.aggregate,
        time_window=snuba_query.time_window,
        snuba_params=snuba_params,
    )

    snql_result = make_snql_request(
        snuba_query.query,
        snuba_query.aggregate,
        time_window=snuba_query.time_window,
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        snuba_params=snuba_params,
    )

    aligned_timeseries = align_timeseries(snql_result=snql_result, rpc_result=rpc_result)

    return assert_timeseries_close(aligned_timeseries)
