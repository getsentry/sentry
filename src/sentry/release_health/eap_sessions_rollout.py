"""Double-read rollout for session health data from EAP.

Queries EAP in parallel with existing metrics and compares results.
Always returns the control (metrics) data. User-facing behavior never changes.
"""

from __future__ import annotations

import logging
import math
from typing import TYPE_CHECKING

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import (
    Expression,
    TimeSeriesRequest,
    TimeSeriesResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.release_health.base import SessionsQueryResult
from sentry.release_health.metrics_sessions_v2 import SessionStatus
from sentry.snuba.sessions_v2 import get_timestamps, isoformat_z
from sentry.utils import metrics
from sentry.utils.snuba_rpc import timeseries_rpc

if TYPE_CHECKING:
    from sentry.snuba.metrics.query import DeprecatingMetricsQuery
    from sentry.snuba.sessions_v2 import QueryDefinition

logger = logging.getLogger(__name__)

# Mapping from session MRI to sessions_v2-style field name.
# Used to translate metrics/data endpoint queries into the format
# the existing EAP request builder expects.
_SESSION_MRI_TO_V2_FIELD: dict[str, str] = {
    "e:sessions/all@none": "sum(session)",
    "e:sessions/crash_free_rate@ratio": "crash_free_rate(session)",
    "e:sessions/crash_rate@ratio": "crash_rate(session)",
    "e:sessions/abnormal_rate@ratio": "abnormal_rate(session)",
    "e:sessions/errored_rate@ratio": "errored_rate(session)",
    "e:sessions/unhealthy_rate@ratio": "unhealthy_rate(session)",
    "s:sessions/user@none": "count_unique(user)",
    "e:sessions/user.all@none": "count_unique(user)",
    "e:sessions/user.crash_free_rate@ratio": "crash_free_rate(user)",
    "e:sessions/user.crash_rate@ratio": "crash_rate(user)",
    "e:sessions/user.anr_rate@ratio": "anr_rate()",
    "e:sessions/user.foreground_anr_rate@ratio": "foreground_anr_rate()",
}

# Mapping from metrics groupBy field names to sessions_v2 groupBy names
_GROUPBY_METRICS_TO_V2: dict[str, str] = {
    "project_id": "project",
    "project": "project",
    "release": "release",
    "environment": "environment",
    "session.status": "session.status",
}

# Session-count based rate fields and their (numerator_status, is_inverted) info.
# is_inverted means the rate is `1 - numerator/denominator`.
_SESSION_RATE_FIELDS: dict[str, tuple[str, bool]] = {
    "crash_free_rate(session)": ("crashed", True),
    "crash_rate(session)": ("crashed", False),
    "errored_rate(session)": ("errored", False),
    "abnormal_rate(session)": ("abnormal", False),
    "unhandled_rate(session)": ("unhandled", False),
}

# User-count based rate fields
_USER_RATE_FIELDS: dict[str, tuple[str, bool]] = {
    "crash_free_rate(user)": ("crashed", True),
    "crash_rate(user)": ("crashed", False),
    "errored_rate(user)": ("errored", False),
    "abnormal_rate(user)": ("abnormal", False),
    "unhandled_rate(user)": ("unhandled", False),
}

# All status values used in conditional aggregations
_SESSION_STATUSES = ("init", "crashed", "errored_preaggr", "abnormal", "unhandled")


def _status_filter(status: str) -> TraceItemFilter:
    """Build a TraceItemFilter matching status=<value>."""
    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name="status", type=AttributeKey.Type.TYPE_STRING),
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_str=status),
        )
    )


_SESSION_COUNT_FIELDS = {
    "sum(session)",
    "unhealthy_rate(session)",
} | set(_SESSION_RATE_FIELDS)

_ANR_FIELDS = {"anr_rate()", "foreground_anr_rate()"}

_USER_COUNT_FIELDS = {"count_unique(user)"} | set(_USER_RATE_FIELDS) | _ANR_FIELDS


def _needs_session_counts(query: QueryDefinition) -> bool:
    """Whether we need session_count conditional aggregations."""
    return "session.status" in query.raw_groupby or bool(
        set(query.raw_fields) & _SESSION_COUNT_FIELDS
    )


def _needs_user_counts(query: QueryDefinition) -> bool:
    """Whether we need user_id_hash conditional aggregations."""
    return "session.status" in query.raw_groupby or bool(set(query.raw_fields) & _USER_COUNT_FIELDS)


def _needs_anr_counts(query: QueryDefinition) -> bool:
    """Whether we need abnormal_mechanism-filtered user count aggregations."""
    return bool(set(query.raw_fields) & _ANR_FIELDS)


def _build_eap_timeseries_request(org_id: int, query: QueryDefinition) -> TimeSeriesRequest:
    """Translate a QueryDefinition into a TimeSeriesRequest protobuf."""
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(query.start)
    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(query.end)

    project_ids = query.params["project_id"]

    expressions: list[Expression] = []

    # Build conditional aggregations for session counts per status
    if _needs_session_counts(query):
        for status in _SESSION_STATUSES:
            label = f"sum_session_{status}"
            expressions.append(
                Expression(
                    conditional_aggregation=AttributeConditionalAggregation(
                        aggregate=Function.FUNCTION_SUM,
                        key=AttributeKey(name="session_count", type=AttributeKey.Type.TYPE_INT),
                        filter=_status_filter(status),
                        label=label,
                    ),
                    label=label,
                )
            )
        # Count of distinct errored sessions from the error set items
        expressions.append(
            Expression(
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_UNIQ,
                    key=AttributeKey(
                        name="errored_session_id_hash", type=AttributeKey.Type.TYPE_ARRAY
                    ),
                    label="errored_set_count",
                ),
                label="errored_set_count",
            )
        )

    # Build aggregations for user counts per status
    if _needs_user_counts(query):
        # Total unique users (non-conditional — user set items don't have "init" status)
        expressions.append(
            Expression(
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_UNIQ,
                    key=AttributeKey(
                        name="user_id_hash",
                        type=AttributeKey.Type.TYPE_ARRAY,
                    ),
                    label="uniq_user_all",
                ),
                label="uniq_user_all",
            )
        )
        # Status-filtered user counts (errored, crashed, abnormal, unhandled
        # are valid statuses on user set items)
        for status in ("errored", "crashed", "abnormal", "unhandled"):
            label = f"uniq_user_{status}"
            expressions.append(
                Expression(
                    conditional_aggregation=AttributeConditionalAggregation(
                        aggregate=Function.FUNCTION_UNIQ,
                        key=AttributeKey(
                            name="user_id_hash",
                            type=AttributeKey.Type.TYPE_ARRAY,
                        ),
                        filter=_status_filter(status),
                        label=label,
                    ),
                    label=label,
                )
            )

    # Build conditional aggregations for ANR user counts
    if _needs_anr_counts(query):
        # All ANRs (foreground + background)
        expressions.append(
            Expression(
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_UNIQ,
                    key=AttributeKey(name="user_id_hash", type=AttributeKey.Type.TYPE_ARRAY),
                    filter=TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="abnormal_mechanism",
                                type=AttributeKey.Type.TYPE_STRING,
                            ),
                            op=ComparisonFilter.OP_IN,
                            value=AttributeValue(
                                val_str_array=StrArray(values=["anr_foreground", "anr_background"])
                            ),
                        )
                    ),
                    label="uniq_user_anr",
                ),
                label="uniq_user_anr",
            )
        )
        # Foreground ANRs only
        expressions.append(
            Expression(
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_UNIQ,
                    key=AttributeKey(name="user_id_hash", type=AttributeKey.Type.TYPE_ARRAY),
                    filter=TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=AttributeKey(
                                name="abnormal_mechanism",
                                type=AttributeKey.Type.TYPE_STRING,
                            ),
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str="anr_foreground"),
                        )
                    ),
                    label="uniq_user_foreground_anr",
                ),
                label="uniq_user_foreground_anr",
            )
        )

    # Group-by translation
    group_by: list[AttributeKey] = []
    for gb in query.raw_groupby:
        if gb == "project":
            group_by.append(AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT))
        elif gb == "release":
            group_by.append(AttributeKey(name="release", type=AttributeKey.Type.TYPE_STRING))
        elif gb == "environment":
            group_by.append(AttributeKey(name="environment", type=AttributeKey.Type.TYPE_STRING))
        # session.status is handled in post-processing, not as a group-by

    # Filter translation
    filters: list[TraceItemFilter] = []
    try:
        conditions = query.get_filter_conditions()
        for cond in conditions:
            from snuba_sdk import Column, Condition

            if not isinstance(cond, Condition) or not isinstance(cond.lhs, Column):
                continue
            col_name = cond.lhs.name
            if col_name == "release":
                eap_key = AttributeKey(name="release", type=AttributeKey.Type.TYPE_STRING)
            elif col_name == "environment":
                eap_key = AttributeKey(name="environment", type=AttributeKey.Type.TYPE_STRING)
            elif col_name == "project_id":
                # project_id is handled via RequestMeta.project_ids
                continue
            else:
                continue

            from snuba_sdk import Op

            if cond.op == Op.EQ:
                filters.append(
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=eap_key,
                            op=ComparisonFilter.OP_EQUALS,
                            value=AttributeValue(val_str=str(cond.rhs)),
                        )
                    )
                )
            elif cond.op == Op.IN:
                filters.append(
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=eap_key,
                            op=ComparisonFilter.OP_IN,
                            value=AttributeValue(
                                val_str_array=StrArray(values=[str(v) for v in cond.rhs])
                            ),
                        )
                    )
                )
    except Exception:
        logger.exception("eap_sessions.filter_translation_failed")

    query_filter = None
    if filters:
        if len(filters) == 1:
            query_filter = filters[0]
        else:
            query_filter = TraceItemFilter(and_filter=AndFilter(filters=filters))

    request = TimeSeriesRequest(
        meta=RequestMeta(
            organization_id=org_id,
            project_ids=project_ids,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_USER_SESSION,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
        ),
        expressions=expressions,
        granularity_secs=query.rollup,
        group_by=group_by,
    )
    if query_filter is not None:
        request.filter.CopyFrom(query_filter)

    return request


def _safe_rate(
    numerator: float | None, denominator: float | None, invert: bool = False
) -> float | None:
    """Compute a rate, returning None for division by zero."""
    if denominator is None or denominator == 0 or numerator is None:
        return None
    rate = numerator / denominator
    if invert:
        rate = 1.0 - rate
    if not math.isfinite(rate):
        return None
    return rate


def _transform_eap_response(
    response: TimeSeriesResponse, query: QueryDefinition
) -> SessionsQueryResult:
    """Convert a TimeSeriesResponse into SessionsQueryResult format."""
    intervals = get_timestamps(query)
    num_buckets = len(intervals)
    has_status_groupby = "session.status" in query.raw_groupby

    # Collect timeseries data by (group_key, label)
    # group_key is a frozenset of (attr_name, attr_value) pairs
    grouped: dict[frozenset[tuple[str, str]], dict[str, list[float]]] = {}

    for ts in response.result_timeseries:
        group_key = frozenset(ts.group_by_attributes.items())
        label = ts.label
        if group_key not in grouped:
            grouped[group_key] = {}

        values: list[float] = []
        for dp in ts.data_points:
            values.append(dp.data if dp.data_present else 0.0)
        # Pad or truncate to match expected buckets
        while len(values) < num_buckets:
            values.append(0.0)
        grouped[group_key][label] = values[:num_buckets]

    # Build groups
    eap_groupby_to_sessions_key = {
        "sentry.project_id": "project",
        "release": "release",
        "environment": "environment",
    }

    result_groups: list[dict] = []

    other_groupbys = [gb for gb in query.raw_groupby if gb != "session.status"]
    if not grouped and has_status_groupby and not other_groupbys:
        grouped[frozenset()] = {}

    if has_status_groupby:
        for group_key, label_data in grouped.items():
            by: dict[str, str | int] = {}
            for attr_name, attr_value in group_key:
                sessions_key = eap_groupby_to_sessions_key.get(attr_name)
                if sessions_key:
                    by[sessions_key] = int(attr_value) if sessions_key == "project" else attr_value

            for session_status in SessionStatus:
                status = session_status.value
                status_by = {**by, "session.status": status}
                series: dict[str, list[float | None]] = {}
                totals: dict[str, float | None] = {}

                for field_name in query.raw_fields:
                    s, t = _extract_status_field(field_name, status, label_data, num_buckets)
                    series[field_name] = s
                    totals[field_name] = t

                result_groups.append({"by": status_by, "series": series, "totals": totals})
    else:
        for group_key, label_data in grouped.items():
            by = {}
            for attr_name, attr_value in group_key:
                sessions_key = eap_groupby_to_sessions_key.get(attr_name)
                if sessions_key:
                    by[sessions_key] = int(attr_value) if sessions_key == "project" else attr_value

            series: dict[str, list[float | None]] = {}
            totals: dict[str, float | None] = {}

            for field_name in query.raw_fields:
                s, t = _extract_field(field_name, label_data, num_buckets)
                series[field_name] = s
                totals[field_name] = t

            result_groups.append({"by": by, "series": series, "totals": totals})

    return {
        "start": isoformat_z(query.start),
        "end": isoformat_z(query.end),
        "intervals": intervals,
        "groups": result_groups,
        "query": query.query,
    }


def _extract_field(
    field_name: str,
    label_data: dict[str, list[float]],
    num_buckets: int,
) -> tuple[list[float | None], float | None]:
    """Extract series and total for a non-status-grouped field."""
    if field_name == "sum(session)":
        values = label_data.get("sum_session_init", [0.0] * num_buckets)
        int_values = [int(v) for v in values]
        return int_values, int(sum(values))

    if field_name == "count_unique(user)":
        values = label_data.get("uniq_user_all", [0.0] * num_buckets)
        int_values = [int(v) for v in values]
        return int_values, int(sum(values))

    if field_name in _SESSION_RATE_FIELDS:
        status, invert = _SESSION_RATE_FIELDS[field_name]
        init_values = label_data.get("sum_session_init", [0.0] * num_buckets)
        if status == "errored":
            # errored_all = errored_preaggr + errored_set
            preaggr = label_data.get("sum_session_errored_preaggr", [0.0] * num_buckets)
            eset = label_data.get("errored_set_count", [0.0] * num_buckets)
            status_values = [preaggr[i] + eset[i] for i in range(num_buckets)]
        else:
            status_values = label_data.get(f"sum_session_{status}", [0.0] * num_buckets)
        series = [_safe_rate(status_values[i], init_values[i], invert) for i in range(num_buckets)]
        total = _safe_rate(sum(status_values), sum(init_values), invert)
        return series, total

    if field_name == "unhealthy_rate(session)":
        init_values = label_data.get("sum_session_init", [0.0] * num_buckets)
        errored_preaggr = label_data.get("sum_session_errored_preaggr", [0.0] * num_buckets)
        errored_set = label_data.get("errored_set_count", [0.0] * num_buckets)
        series = []
        total_unhealthy = 0.0
        total_init = 0.0
        for i in range(num_buckets):
            unhealthy = errored_preaggr[i] + errored_set[i]
            series.append(_safe_rate(unhealthy, init_values[i]))
            total_unhealthy += unhealthy
            total_init += init_values[i]
        total = _safe_rate(total_unhealthy, total_init)
        return series, total

    if field_name in _USER_RATE_FIELDS:
        status, invert = _USER_RATE_FIELDS[field_name]
        all_values = label_data.get("uniq_user_all", [0.0] * num_buckets)
        status_values = label_data.get(f"uniq_user_{status}", [0.0] * num_buckets)
        series = [_safe_rate(status_values[i], all_values[i], invert) for i in range(num_buckets)]
        total = _safe_rate(sum(status_values), sum(all_values), invert)
        return series, total

    if field_name == "anr_rate()":
        return _extract_anr_field(label_data, num_buckets, foreground_only=False)

    if field_name == "foreground_anr_rate()":
        return _extract_anr_field(label_data, num_buckets, foreground_only=True)

    # Unknown field — return zeros
    return [0.0] * num_buckets, 0.0


def _extract_anr_field(
    label_data: dict[str, list[float]],
    num_buckets: int,
    foreground_only: bool,
) -> tuple[list[float | None], float | None]:
    """Compute ANR rate from abnormal_mechanism-filtered user counts."""
    all_values = label_data.get("uniq_user_all", [0.0] * num_buckets)
    anr_label = "uniq_user_foreground_anr" if foreground_only else "uniq_user_anr"
    anr_values = label_data.get(anr_label, [0.0] * num_buckets)
    series = [_safe_rate(anr_values[i], all_values[i]) for i in range(num_buckets)]
    total = _safe_rate(sum(anr_values), sum(all_values))
    return series, total


def _extract_status_field(
    field_name: str,
    status: str,
    label_data: dict[str, list[float]],
    num_buckets: int,
) -> tuple[list[float | None], float | None]:
    """Extract series/total for a field within a session.status group."""
    if field_name == "sum(session)":
        return _session_count_for_status(status, label_data, num_buckets)

    if field_name == "count_unique(user)":
        return _user_count_for_status(status, label_data, num_buckets)

    # Rate fields in status-grouped context
    if (
        field_name in _SESSION_RATE_FIELDS
        or field_name in _USER_RATE_FIELDS
        or field_name == "unhealthy_rate(session)"
    ):
        return _extract_field(field_name, label_data, num_buckets)

    if field_name in ("anr_rate()", "foreground_anr_rate()"):
        return _extract_field(field_name, label_data, num_buckets)

    return [0.0] * num_buckets, 0.0


def _session_count_for_status(
    status: str,
    label_data: dict[str, list[float]],
    num_buckets: int,
) -> tuple[list[float | None], float | None]:
    """Get session count for a specific status."""
    if status == "healthy":
        init = label_data.get("sum_session_init", [0.0] * num_buckets)
        errored_preaggr = label_data.get("sum_session_errored_preaggr", [0.0] * num_buckets)
        errored_set = label_data.get("errored_set_count", [0.0] * num_buckets)
        values = [
            int(max(init[i] - errored_preaggr[i] - errored_set[i], 0)) for i in range(num_buckets)
        ]
        return values, sum(values)

    if status == "errored":
        errored_preaggr = label_data.get("sum_session_errored_preaggr", [0.0] * num_buckets)
        errored_set = label_data.get("errored_set_count", [0.0] * num_buckets)
        crashed = label_data.get("sum_session_crashed", [0.0] * num_buckets)
        abnormal = label_data.get("sum_session_abnormal", [0.0] * num_buckets)
        values = [
            int(max(errored_preaggr[i] + errored_set[i] - crashed[i] - abnormal[i], 0))
            for i in range(num_buckets)
        ]
        return values, sum(values)

    key = f"sum_session_{status}"
    values = label_data.get(key, [0.0] * num_buckets)
    return [int(v) for v in values], int(sum(values))


def _user_count_for_status(
    status: str,
    label_data: dict[str, list[float]],
    num_buckets: int,
) -> tuple[list[float | None], float | None]:
    """Get user count for a specific status."""
    if status == "healthy":
        all_users = label_data.get("uniq_user_all", [0.0] * num_buckets)
        errored = label_data.get("uniq_user_errored", [0.0] * num_buckets)
        values = [int(max(all_users[i] - errored[i], 0)) for i in range(num_buckets)]
        return values, sum(values)

    if status == "errored":
        errored = label_data.get("uniq_user_errored", [0.0] * num_buckets)
        crashed = label_data.get("uniq_user_crashed", [0.0] * num_buckets)
        abnormal = label_data.get("uniq_user_abnormal", [0.0] * num_buckets)
        values = [int(max(errored[i] - crashed[i] - abnormal[i], 0)) for i in range(num_buckets)]
        return values, sum(values)

    key = f"uniq_user_{status}"
    values = label_data.get(key, [0.0] * num_buckets)
    return [int(v) for v in values], int(sum(values))


def run_sessions_query_eap(org_id: int, query: QueryDefinition) -> SessionsQueryResult:
    """Query EAP for session health data, translating to SessionsQueryResult format."""
    request = _build_eap_timeseries_request(org_id, query)
    responses = timeseries_rpc([request])
    assert len(responses) == 1
    return _transform_eap_response(responses[0], query)


def compare_results(control: SessionsQueryResult, experimental: SessionsQueryResult) -> None:
    """Shadow-compare control (legacy metrics) and experimental (EAP) results.

    Emits a metric indicating whether the results match. The control result
    is always used downstream — this is purely for validation.
    """
    exact_match = control == experimental
    is_null = len(experimental.get("groups", [])) == 0
    if not exact_match:
        logger.error(f"Control and eap results do not match: {control} != {experimental}")

    metrics.incr(
        "eap_sessions.compare",
        tags={
            "exact_match": str(exact_match),
            "is_null_result": str(is_null),
        },
    )


class _MetricsQueryAdapter:
    """Adapts a DeprecatingMetricsQuery to the sessions_v2 QueryDefinition
    interface expected by _build_eap_timeseries_request."""

    def __init__(
        self,
        raw_fields: list[str],
        raw_groupby: list[str],
        start,
        end,
        rollup: int,
        project_ids: list[int],
        query: str,
        where: list,
    ):
        self.raw_fields = raw_fields
        self.raw_groupby = raw_groupby
        self.start = start
        self.end = end
        self.rollup = rollup
        self.params = {"project_id": project_ids}
        self.query = query
        self._where = where

    def get_filter_conditions(self):
        return self._where


def is_session_metrics_query(metrics_query: DeprecatingMetricsQuery) -> bool:
    """Check if a DeprecatingMetricsQuery targets session metrics."""
    for field in metrics_query.select:
        if field.metric_mri in _SESSION_MRI_TO_V2_FIELD:
            return True
    return False


def _translate_metrics_query(
    metrics_query: DeprecatingMetricsQuery,
) -> tuple[_MetricsQueryAdapter, dict[str, str]] | None:
    """Translate a DeprecatingMetricsQuery to a sessions_v2-compatible adapter.

    Returns (adapter, field_mapping) where field_mapping maps
    sessions_v2 field names back to the metric field aliases used in
    get_series results. Returns None if any field cannot be translated.
    """
    raw_fields: list[str] = []
    # Maps sessions_v2 field name -> metric alias (for result remapping)
    field_mapping: dict[str, str] = {}

    for field in metrics_query.select:
        v2_name = _SESSION_MRI_TO_V2_FIELD.get(field.metric_mri)
        if v2_name is None:
            return None
        raw_fields.append(v2_name)
        field_mapping[v2_name] = field.alias

    raw_groupby: list[str] = []
    if metrics_query.groupby:
        for gb in metrics_query.groupby:
            gb_name = gb.name if hasattr(gb, "name") else str(gb.field)
            v2_gb = _GROUPBY_METRICS_TO_V2.get(gb_name)
            if v2_gb is None:
                return None
            raw_groupby.append(v2_gb)

    adapter = _MetricsQueryAdapter(
        raw_fields=raw_fields,
        raw_groupby=raw_groupby,
        start=metrics_query.start,
        end=metrics_query.end,
        rollup=metrics_query.granularity.granularity,
        project_ids=list(metrics_query.project_ids),
        query="",
        where=list(metrics_query.where) if metrics_query.where else [],
    )
    return adapter, field_mapping


def get_series_eap(
    metrics_query: DeprecatingMetricsQuery,
    org_id: int,
) -> dict | None:
    """Query EAP for session data matching a metrics/data endpoint query.

    Returns the result in the same format as get_series() with field names
    matching the metric aliases, or None if the query can't be translated.
    """
    translated = _translate_metrics_query(metrics_query)
    if translated is None:
        return None

    adapter, field_mapping = translated
    request = _build_eap_timeseries_request(org_id, adapter)
    logger.error(
        "eap_sessions.get_series_eap_request",
        extra={
            "org_id": org_id,
            "project_ids": list(adapter.params["project_id"]),
            "raw_fields": adapter.raw_fields,
            "raw_groupby": adapter.raw_groupby,
            "start": str(adapter.start),
            "end": str(adapter.end),
            "rollup": adapter.rollup,
            "num_expressions": len(request.expressions),
            "expression_labels": [e.label for e in request.expressions],
        },
    )
    responses = timeseries_rpc([request])
    assert len(responses) == 1
    logger.error(
        "eap_sessions.get_series_eap_response",
        extra={
            "num_timeseries": len(responses[0].result_timeseries),
            "labels": [ts.label for ts in responses[0].result_timeseries],
        },
    )
    eap_result = _transform_eap_response(responses[0], adapter)

    include_totals = metrics_query.include_totals
    include_series = metrics_query.include_series

    # Remap field names and conform to get_series() output shape
    for group in eap_result.get("groups", []):
        for section in ("series", "totals"):
            old_data = group.get(section, {})
            new_data = {}
            for v2_name, value in old_data.items():
                metric_alias = field_mapping.get(v2_name, v2_name)
                # get_series returns float values, match that
                if isinstance(value, list):
                    new_data[metric_alias] = [float(v) if v is not None else None for v in value]
                elif value is not None:
                    new_data[metric_alias] = float(value)
                else:
                    new_data[metric_alias] = None
            group[section] = new_data

        # Strip totals/series to match get_series() behavior
        if not include_totals:
            group.pop("totals", None)
        if not include_series:
            group.pop("series", None)

        # Remap groupBy keys: "project" -> "project_id"
        by = group.get("by", {})
        if "project" in by:
            by["project_id"] = by.pop("project")

    return eap_result


def compare_get_series_results(control: dict, experimental: dict) -> None:
    """Shadow-compare get_series results from legacy metrics and EAP.

    Similar to compare_results but for the get_series response format
    where start/end are datetime objects (not ISO strings).
    """
    control_groups = control.get("groups", [])
    exp_groups = experimental.get("groups", [])
    exact_match = control_groups == exp_groups
    is_null = len(exp_groups) == 0

    if not exact_match:
        logger.error(
            "********************** eap_sessions.get_series_mismatch",
            extra={"control_groups": control_groups, "eap_groups": exp_groups},
        )
    else:
        logger.error("********************** SUCCESS!")

    metrics.incr(
        "eap_sessions.get_series_compare",
        tags={
            "exact_match": str(exact_match),
            "is_null_result": str(is_null),
        },
    )
