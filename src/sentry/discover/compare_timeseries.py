import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, TypedDict
from urllib.parse import urlencode

import sentry_sdk
from django.urls import reverse

from sentry import features
from sentry.api.bases.organization import NoProjects
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.exceptions import IncompatibleMetricsQuery
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


def format_api_call(organization_slug, **kwargs):
    url = reverse(
        "sentry-api-0-organization-events-stats",
        kwargs={"organization_id_or_slug": organization_slug},
    )

    return url, urlencode({**kwargs})


class MismatchType(Enum):
    SNQL_ALWAYS_ZERO = "snql_always_zero"
    RPC_ALWAYS_ZERO = "rpc_always_zero"
    SNQL_ALWAYS_LOWER = "snql_always_lower"
    RPC_ALWAYS_LOWER = "rpc_always_lower"
    MORE_SPIKY = "more_spiky"
    LESS_SPIKY = "less_spiky"
    INCOMPATIBLE_METRICS = "incompatible_metrics"
    INSUFFICIENT_DATA = "insufficient_data"


def get_time_window_for_interval(interval: int):
    if interval in [60, 300, 600]:
        return timedelta(days=1)

    if interval == 24 * 60 * 60:
        return timedelta(days=14)

    return timedelta(days=3)


class TSResultForComparison(TypedDict):
    result: SnubaTSResult
    agg_alias: str


def make_rpc_request(
    query: str,
    aggregate: str,
    snuba_params: SnubaParams,
    organization: Organization,
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
        sampling_mode=None,
    )

    assert snuba_params.start is not None
    assert snuba_params.end is not None

    path, query = format_api_call(
        organization.slug,
        query=query_parts["query"],
        useRpc=1,
        project=snuba_params.project_ids[0],
        yAxis=query_parts["selected_columns"][0],
        dataset="spans",
        interval=snuba_params.granularity_secs,
        start=snuba_params.start.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        end=snuba_params.end.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        sampling="BEST_EFFORT",
    )
    api_call = organization.absolute_url(path, query)
    sentry_sdk.set_extra("eap_call", api_call)

    return TSResultForComparison(result=results, agg_alias=query_parts["selected_columns"][0])


def make_snql_request(
    query: str,
    aggregate: str,
    time_window: int,
    on_demand_metrics_enabled: bool,
    snuba_params: SnubaParams,
    organization: Organization,
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

    assert snuba_params.start is not None
    assert snuba_params.end is not None

    path, query = format_api_call(
        organization.slug,
        query=query,
        project=snuba_params.project_ids[0],
        yAxis=aggregate,
        dataset="metricsEnhanced",
        interval=snuba_params.granularity_secs,
        start=snuba_params.start.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        end=snuba_params.end.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
    )
    api_call = organization.absolute_url(path, query)
    sentry_sdk.set_extra("metrics_call", api_call)

    return TSResultForComparison(result=results, agg_alias=get_function_alias(aggregate))


def get_mismatch_type(mismatches: dict[int, dict[str, float]]):
    all_snql_values_zero = True
    all_rpc_values_zero = True
    snql_always_lower = True
    rpc_always_lower = True

    has_high_diff = False

    low_conf_bucket_count = 0
    low_sampling_rate_bucket_count = 0

    for values in mismatches.values():
        snql_value = values["snql_value"]
        rpc_value = values["rpc_value"]
        diff = values["mismatch_percentage"]
        confidence = values["confidence"]
        sampling_rate = values["sampling_rate"]

        if snql_value > 0:
            all_snql_values_zero = False

        if rpc_value > 0:
            all_rpc_values_zero = False

        if rpc_value >= snql_value:
            rpc_always_lower = False

        if snql_value >= rpc_value:
            snql_always_lower = False

        if snql_value > 0 and rpc_value > 0 and diff > 0.2:
            has_high_diff = True

        if confidence == "low":
            low_conf_bucket_count += 1

        if sampling_rate and sampling_rate < 0.05:
            low_sampling_rate_bucket_count += 1

    many_low_conf_buckets = low_conf_bucket_count > len(mismatches) / 2
    many_low_sample_rate_buckets = low_sampling_rate_bucket_count > len(mismatches) / 2

    if all_snql_values_zero:
        return MismatchType.SNQL_ALWAYS_ZERO, many_low_conf_buckets, many_low_sample_rate_buckets

    if all_rpc_values_zero:
        return MismatchType.RPC_ALWAYS_ZERO, many_low_conf_buckets, many_low_sample_rate_buckets

    if snql_always_lower:
        return MismatchType.SNQL_ALWAYS_LOWER, many_low_conf_buckets, many_low_sample_rate_buckets

    if rpc_always_lower:
        return MismatchType.RPC_ALWAYS_LOWER, many_low_conf_buckets, many_low_sample_rate_buckets

    if has_high_diff:
        return MismatchType.MORE_SPIKY, many_low_conf_buckets, many_low_sample_rate_buckets

    return MismatchType.LESS_SPIKY, many_low_conf_buckets, many_low_sample_rate_buckets


def align_timeseries(snql_result: TSResultForComparison, rpc_result: TSResultForComparison):
    aligned_results: dict[str, Any] = defaultdict(lambda: {"rpc_value": None, "snql_value": None})

    def fill_aligned_series(data: list[dict[str, Any]], alias: str, key: str):
        for element in data:
            element_value = element.get(alias) or 0
            element_time = element["time"]
            aligned_results[element_time][key] = element_value

    fill_aligned_series(snql_result["result"].data["data"], snql_result["agg_alias"], "snql_value")
    fill_aligned_series(rpc_result["result"].data["data"], rpc_result["agg_alias"], "rpc_value")
    fill_aligned_series(
        rpc_result["result"].data["processed_timeseries"].confidence,
        rpc_result["agg_alias"],
        "confidence",
    )
    fill_aligned_series(
        rpc_result["result"].data["processed_timeseries"].sampling_rate,
        rpc_result["agg_alias"],
        "sampling_rate",
    )

    return aligned_results


def assert_timeseries_close(aligned_timeseries, alert_rule):
    mismatches: dict[int, dict[str, float]] = {}
    missing_buckets = 0
    all_zeros = True
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

        all_zeros = False
        mismatch = abs(rpc_value - snql_value)
        average = (rpc_value + snql_value) / 2
        diff = mismatch / average

        if diff > 0.05:
            mismatches[timestamp] = {
                "rpc_value": rpc_value,
                "snql_value": snql_value,
                "mismatch_percentage": diff,
                "sampling_rate": values["sampling_rate"],
                "confidence": values["confidence"],
            }

    if mismatches:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("mismatches", mismatches)

            scope.set_tag(
                "buckets_mismatch.percentage", len(mismatches) / len(aligned_timeseries) * 100
            )
            scope.set_tag("buckets_mismatch.count", len(mismatches))

            mismatch_type, many_low_conf_buckets, many_low_sample_rate_buckets = get_mismatch_type(
                mismatches
            )
            scope.set_tag("mismatch_type", mismatch_type.value)
            scope.set_tag("many_low_conf_buckets", many_low_conf_buckets)
            scope.set_tag("many_low_sample_rate_buckets", many_low_sample_rate_buckets)

            sentry_sdk.capture_message("Timeseries mismatch", level="info")
            logger.info("Alert %s has too many mismatches", alert_rule.id)

            return False, mismatches, all_zeros

    if missing_buckets > 1:
        sentry_sdk.capture_message("Multiple missing buckets", level="info")
        logger.info("Alert %s has multiple missing buckets", alert_rule.id)

        return False, mismatches, all_zeros

    logger.info("Alert %s timeseries is close", alert_rule.id)
    return True, mismatches, all_zeros


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

    sentry_sdk.set_tag("organization", organization.slug)
    sentry_sdk.set_extra("alert_id", alert_rule.id)

    on_demand_metrics_enabled = features.has(
        "organizations:on-demand-metrics-extraction",
        organization,
    )

    # Align time to the nearest hour because RPCs roll up on exact timestamps.
    now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)

    environments = []
    if snuba_query.environment:
        environments = [snuba_query.environment]

    time_window = get_time_window_for_interval(snuba_query.time_window)
    snuba_params = SnubaParams(
        environments=environments,
        projects=[project],
        organization=organization,
        start=now - time_window,
        end=now,
        granularity_secs=snuba_query.time_window,
    )

    rpc_result = make_rpc_request(
        snuba_query.query,
        snuba_query.aggregate,
        snuba_params=snuba_params,
        organization=organization,
    )

    try:
        snql_result = make_snql_request(
            snuba_query.query,
            snuba_query.aggregate,
            time_window=snuba_query.time_window,
            on_demand_metrics_enabled=on_demand_metrics_enabled,
            snuba_params=snuba_params,
            organization=organization,
        )
    except IncompatibleMetricsQuery:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("mismatch_type", MismatchType.INCOMPATIBLE_METRICS.value)
            sentry_sdk.capture_message("Timeseries mismatch", level="info")

        return {"is_close": False, "skipped": False, "mismatches": []}

    aligned_timeseries = align_timeseries(snql_result=snql_result, rpc_result=rpc_result)
    is_close, mismatches, all_zeros = assert_timeseries_close(aligned_timeseries, alert_rule)

    if all_zeros:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("mismatch_type", MismatchType.INSUFFICIENT_DATA.value)
            sentry_sdk.capture_message("Timeseries mismatch", level="info")

        return {"is_close": False, "skipped": False, "mismatches": mismatches}

    return {"is_close": is_close, "skipped": False, "mismatches": mismatches}
