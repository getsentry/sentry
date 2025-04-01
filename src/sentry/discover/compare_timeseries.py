import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict

import sentry_sdk

from sentry import features
from sentry.api.bases.organization import NoProjects
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import SnubaParams
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.metrics import parse_mri_field
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.metrics_performance import timeseries_query
from sentry.snuba.models import SnubaQuery
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import run_timeseries_query
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)


class TSResultForComparison(TypedDict):
    result: SnubaTSResult
    agg_alias: str


def make_rpc_request(
    query: str,
    aggregate: str,
    snuba_params: SnubaParams,
) -> TSResultForComparison:
    query = apply_dataset_query_conditions(SnubaQuery.Type.PERFORMANCE, query, None)

    query_parts = QueryParts(selected_columns=[aggregate], query=query, equations=[], orderby=[])
    query_parts = translate_mep_to_eap(query_parts)

    results = run_timeseries_query(
        snuba_params,
        query_string=query_parts["query"],
        y_axes=query_parts["selected_columns"],
        referrer=Referrer.JOB_COMPARE_TIMESERIES.value,
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
        referrer=Referrer.JOB_COMPARE_TIMESERIES.value,
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
        zerofill_results=True,
    )

    return TSResultForComparison(result=results, agg_alias=get_function_alias(aggregate))


def align_timeseries(snql_result: TSResultForComparison, rpc_result: TSResultForComparison):
    aligned_results: dict[str, Any] = defaultdict(lambda: {"rpc_value": None, "snql_value": None})

    def fill_aligned_series(data: dict[str, Any], alias: str, key: str):
        for element in data["data"]:
            element_value = element.get(alias) or 0
            element_time = element["time"]
            aligned_results[element_time][key] = float(element_value)

    fill_aligned_series(snql_result["result"].data, snql_result["agg_alias"], "snql_value")
    fill_aligned_series(rpc_result["result"].data, rpc_result["agg_alias"], "rpc_value")

    return aligned_results


def assert_timeseries_close(aligned_timeseries, alert_rule):
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
                "mismatch_percentage": diff,
            }

    if mismatches:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("mismatches", mismatches)
            scope.set_extra("alert_id", alert_rule.id)
            sentry_sdk.capture_message("Timeseries mismatch", level="info")
            logger.info("Alert %s has too many mismatches", alert_rule.id)

            return False, mismatches

    if missing_buckets > 1:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("alert_id", alert_rule.id)
            sentry_sdk.capture_message("Multiple missing buckets", level="info")
            logger.info("Alert %s has multiple missing buckets", alert_rule.id)

            return False, mismatches

    logger.info("Alert %s timeseries is close", alert_rule.id)
    return True, mismatches


def compare_timeseries_for_alert_rule(alert_rule: AlertRule):
    snuba_query: SnubaQuery = alert_rule.snuba_query
    project = alert_rule.projects.first()
    if not project:
        raise NoProjects

    if snuba_query.aggregate in ["apdex()"]:
        logger.info(
            "Skipping alert %s, %s aggregate not yet supported by RPC",
            alert_rule.id,
            snuba_query.aggregate,
        )
        return {"skipped": True, "is_close": False}

    if parse_mri_field(snuba_query.aggregate):
        logger.info(
            "Skipping alert %s, %s, MRI fields not supported in aggregates",
            alert_rule.id,
            snuba_query.aggregate,
        )
        return {"skipped": True, "is_close": False}

    organization = Organization.objects.get_from_cache(id=project.organization_id)

    on_demand_metrics_enabled = features.has(
        "organizations:on-demand-metrics-extraction",
        organization,
    )

    # Align time to the nearest hour because RPCs roll up on exact timestamps.
    now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)

    environments = []
    if snuba_query.environment:
        environments = [snuba_query.environment]

    snuba_params = SnubaParams(
        environments=environments,
        projects=[project],
        organization=organization,
        start=now - timedelta(days=1),
        end=now,
        granularity_secs=snuba_query.time_window,
    )

    rpc_result = make_rpc_request(
        snuba_query.query,
        snuba_query.aggregate,
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

    is_close, mismatches = assert_timeseries_close(aligned_timeseries, alert_rule)

    return {"is_close": is_close, "skipped": False, "mismatches": mismatches}
