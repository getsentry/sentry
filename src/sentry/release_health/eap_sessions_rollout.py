"""Double-read rollout for session health data from EAP.

Queries EAP in parallel with existing metrics and compares results.
Always returns the control (metrics) data. User-facing behavior never changes.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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

from sentry.snuba.sessions_v2 import isoformat_z
from sentry.utils import metrics
from sentry.utils.snuba_rpc import timeseries_rpc

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sentry.snuba.metrics.query import DeprecatingMetricsQuery

logger = logging.getLogger(__name__)

_SESSION_STATUSES = ("healthy", "crashed", "errored", "abnormal", "unhandled")

# All status values used in conditional aggregations for session counts
_SESSION_COUNT_STATUSES = ("init", "crashed", "errored_preaggr", "abnormal", "unhandled")


@dataclass(frozen=True)
class _FieldSpec:
    """Describes what a session MRI field needs from EAP."""

    kind: str  # "session_count", "user_count", "session_rate", "user_rate"
    status: str = ""
    inverted: bool = False


_MRI_TO_FIELD: dict[str, _FieldSpec] = {
    "e:sessions/all@none": _FieldSpec("session_count"),
    "e:sessions/crash_free_rate@ratio": _FieldSpec("session_rate", "crashed", True),
    "s:sessions/user@none": _FieldSpec("user_count"),
    "e:sessions/user.all@none": _FieldSpec("user_count"),
    "e:sessions/user.crash_free_rate@ratio": _FieldSpec("user_rate", "crashed", True),
}

_GROUPBY_TO_EAP: dict[str, tuple[str, AttributeKey.Type.ValueType]] = {
    "project_id": ("sentry.project_id", AttributeKey.Type.TYPE_INT),
    "project": ("sentry.project_id", AttributeKey.Type.TYPE_INT),
    "release": ("release", AttributeKey.Type.TYPE_STRING),
    "environment": ("environment", AttributeKey.Type.TYPE_STRING),
}

_EAP_ATTR_TO_OUTPUT_KEY: dict[str, str] = {
    "sentry.project_id": "project_id",
    "release": "release",
    "environment": "environment",
}

_FILTER_COLUMNS: dict[str, AttributeKey.Type.ValueType] = {
    "release": AttributeKey.Type.TYPE_STRING,
    "environment": AttributeKey.Type.TYPE_STRING,
}


def _eq_filter(
    attr_name: str, attr_type: AttributeKey.Type.ValueType, value: str
) -> TraceItemFilter:
    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name=attr_name, type=attr_type),
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_str=value),
        )
    )


def _in_filter(
    attr_name: str, attr_type: AttributeKey.Type.ValueType, values: list[str]
) -> TraceItemFilter:
    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name=attr_name, type=attr_type),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(val_str_array=StrArray(values=values)),
        )
    )


def _agg_expr(
    func: Function.ValueType,
    attr_name: str,
    attr_type: AttributeKey.Type.ValueType,
    label: str,
    filt: TraceItemFilter | None = None,
) -> Expression:
    if filt is not None:
        return Expression(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=func,
                key=AttributeKey(name=attr_name, type=attr_type),
                filter=filt,
                label=label,
            ),
            label=label,
        )
    return Expression(
        aggregation=AttributeAggregation(
            aggregate=func,
            key=AttributeKey(name=attr_name, type=attr_type),
            label=label,
        ),
        label=label,
    )


def _translate_where(where: Sequence) -> list[TraceItemFilter]:
    """Translate snuba_sdk conditions to TraceItemFilters."""
    filters: list[TraceItemFilter] = []
    try:
        from snuba_sdk import Column, Condition, Op

        for cond in where:
            if not isinstance(cond, Condition) or not isinstance(cond.lhs, Column):
                continue
            attr_type = _FILTER_COLUMNS.get(cond.lhs.name)
            if attr_type is None:
                continue
            if cond.op == Op.EQ:
                filters.append(_eq_filter(cond.lhs.name, attr_type, str(cond.rhs)))
            elif cond.op == Op.IN:
                filters.append(_in_filter(cond.lhs.name, attr_type, [str(v) for v in cond.rhs]))
    except Exception:
        logger.exception("eap_sessions.filter_translation_failed")
    return filters


def _build_eap_timeseries_request(
    org_id: int,
    project_ids: Sequence[int],
    fields: list[_FieldSpec],
    raw_groupby: list[str],
    start: datetime,
    end: datetime,
    rollup: int,
    where: Sequence,
) -> TimeSeriesRequest:
    """Build a TimeSeriesRequest protobuf from explicit parameters."""
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)
    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    kinds = {f.kind for f in fields}
    has_status_groupby = "session.status" in raw_groupby
    need_session_counts = has_status_groupby or kinds & {"session_count", "session_rate"}
    need_user_counts = has_status_groupby or kinds & {"user_count", "user_rate"}

    expressions: list[Expression] = []

    if need_session_counts:
        for status in _SESSION_COUNT_STATUSES:
            label = f"sum_session_{status}"
            expressions.append(
                _agg_expr(
                    Function.FUNCTION_SUM,
                    "session_count",
                    AttributeKey.Type.TYPE_INT,
                    label,
                    _eq_filter("status", AttributeKey.Type.TYPE_STRING, status),
                )
            )
        expressions.append(
            _agg_expr(
                Function.FUNCTION_UNIQ,
                "errored_session_id_hash",
                AttributeKey.Type.TYPE_ARRAY,
                "errored_set_count",
            )
        )

    if need_user_counts:
        expressions.append(
            _agg_expr(
                Function.FUNCTION_UNIQ,
                "user_id_hash",
                AttributeKey.Type.TYPE_ARRAY,
                "uniq_user_all",
            )
        )
        for status in ("errored", "crashed", "abnormal", "unhandled"):
            label = f"uniq_user_{status}"
            expressions.append(
                _agg_expr(
                    Function.FUNCTION_UNIQ,
                    "user_id_hash",
                    AttributeKey.Type.TYPE_ARRAY,
                    label,
                    _eq_filter("status", AttributeKey.Type.TYPE_STRING, status),
                )
            )

    # Group-by translation
    group_by: list[AttributeKey] = []
    for gb in raw_groupby:
        eap = _GROUPBY_TO_EAP.get(gb)
        if eap:
            group_by.append(AttributeKey(name=eap[0], type=eap[1]))

    # Filter translation
    filters = _translate_where(where)
    query_filter = None
    if filters:
        query_filter = (
            filters[0]
            if len(filters) == 1
            else TraceItemFilter(and_filter=AndFilter(filters=filters))
        )

    request = TimeSeriesRequest(
        meta=RequestMeta(
            organization_id=org_id,
            project_ids=list(project_ids),
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_USER_SESSION,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
        ),
        expressions=expressions,
        granularity_secs=rollup,
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


def _extract(
    spec: _FieldSpec,
    label_data: dict[str, list[float]],
    n: int,
) -> tuple[list[float | None], float | None]:
    """Extract series and total for a non-status-grouped field."""
    zeros = [0.0] * n

    if spec.kind == "session_count":
        values = label_data.get("sum_session_init", zeros)
        result: list[float | None] = [int(v) for v in values]
        return result, int(sum(values))

    if spec.kind == "user_count":
        values = label_data.get("uniq_user_all", zeros)
        result_u: list[float | None] = [int(v) for v in values]
        return result_u, int(sum(values))

    if spec.kind == "session_rate":
        init_values = label_data.get("sum_session_init", zeros)
        if spec.status == "errored":
            preaggr = label_data.get("sum_session_errored_preaggr", zeros)
            eset = label_data.get("errored_set_count", zeros)
            status_values = [preaggr[i] + eset[i] for i in range(n)]
        else:
            status_values = label_data.get(f"sum_session_{spec.status}", zeros)
        series = [_safe_rate(status_values[i], init_values[i], spec.inverted) for i in range(n)]
        total = _safe_rate(sum(status_values), sum(init_values), spec.inverted)
        return series, total

    if spec.kind == "user_rate":
        all_values = label_data.get("uniq_user_all", zeros)
        status_values = label_data.get(f"uniq_user_{spec.status}", zeros)
        series = [_safe_rate(status_values[i], all_values[i], spec.inverted) for i in range(n)]
        total = _safe_rate(sum(status_values), sum(all_values), spec.inverted)
        return series, total

    fallback: list[float | None] = [0.0] * n
    return fallback, 0.0


def _extract_for_status(
    spec: _FieldSpec,
    status: str,
    label_data: dict[str, list[float]],
    n: int,
) -> tuple[list[float | None], float | None]:
    """Extract series/total for a field within a session.status group."""
    if spec.kind == "session_count":
        return _session_count_for_status(status, label_data, n)
    if spec.kind == "user_count":
        return _user_count_for_status(status, label_data, n)
    # Rates are not status-dependent
    return _extract(spec, label_data, n)


def _session_count_for_status(
    status: str,
    label_data: dict[str, list[float]],
    n: int,
) -> tuple[list[float | None], float | None]:
    """Get session count for a specific status."""
    zeros = [0.0] * n
    if status == "healthy":
        init = label_data.get("sum_session_init", zeros)
        errored_preaggr = label_data.get("sum_session_errored_preaggr", zeros)
        errored_set = label_data.get("errored_set_count", zeros)
        result: list[float | None] = [
            int(max(init[i] - errored_preaggr[i] - errored_set[i], 0)) for i in range(n)
        ]
        return result, sum(v for v in result if v is not None)

    if status == "errored":
        errored_preaggr = label_data.get("sum_session_errored_preaggr", zeros)
        errored_set = label_data.get("errored_set_count", zeros)
        crashed = label_data.get("sum_session_crashed", zeros)
        abnormal = label_data.get("sum_session_abnormal", zeros)
        result_e: list[float | None] = [
            int(max(errored_preaggr[i] + errored_set[i] - crashed[i] - abnormal[i], 0))
            for i in range(n)
        ]
        return result_e, sum(v for v in result_e if v is not None)

    key = f"sum_session_{status}"
    raw = label_data.get(key, zeros)
    result_s: list[float | None] = [int(v) for v in raw]
    return result_s, int(sum(raw))


def _user_count_for_status(
    status: str,
    label_data: dict[str, list[float]],
    n: int,
) -> tuple[list[float | None], float | None]:
    """Get user count for a specific status."""
    zeros = [0.0] * n
    if status == "healthy":
        all_users = label_data.get("uniq_user_all", zeros)
        errored = label_data.get("uniq_user_errored", zeros)
        result: list[float | None] = [int(max(all_users[i] - errored[i], 0)) for i in range(n)]
        return result, sum(v for v in result if v is not None)

    if status == "errored":
        errored = label_data.get("uniq_user_errored", zeros)
        crashed = label_data.get("uniq_user_crashed", zeros)
        abnormal = label_data.get("uniq_user_abnormal", zeros)
        result_e: list[float | None] = [
            int(max(errored[i] - crashed[i] - abnormal[i], 0)) for i in range(n)
        ]
        return result_e, sum(v for v in result_e if v is not None)

    key = f"uniq_user_{status}"
    raw = label_data.get(key, zeros)
    result_s: list[float | None] = [int(v) for v in raw]
    return result_s, int(sum(raw))


def _transform_eap_response(
    response: TimeSeriesResponse,
    fields: list[_FieldSpec],
    field_alias_map: dict[_FieldSpec, str],
    raw_groupby: list[str],
    start: datetime,
    end: datetime,
    rollup: int,
    include_totals: bool,
    include_series: bool,
) -> dict:
    """Convert a TimeSeriesResponse into the final get_series output format."""
    start_ts = int(start.timestamp())
    end_ts = int(end.timestamp())
    intervals = [
        isoformat_z(start.fromtimestamp(ts, tz=start.tzinfo))
        for ts in range(start_ts, end_ts, rollup)
    ]
    num_buckets = len(intervals)
    has_status_groupby = "session.status" in raw_groupby

    # Collect timeseries data by (group_key, label)
    grouped: dict[frozenset[tuple[str, str]], dict[str, list[float]]] = {}

    for ts in response.result_timeseries:
        group_key = frozenset(ts.group_by_attributes.items())
        label = ts.label
        if group_key not in grouped:
            grouped[group_key] = {}

        values: list[float] = []
        for dp in ts.data_points:
            values.append(dp.data if dp.data_present else 0.0)
        while len(values) < num_buckets:
            values.append(0.0)
        grouped[group_key][label] = values[:num_buckets]

    result_groups: list[dict] = []

    other_groupbys = [gb for gb in raw_groupby if gb != "session.status"]
    if not grouped and has_status_groupby and not other_groupbys:
        grouped[frozenset()] = {}

    for group_key, label_data in grouped.items():
        by: dict[str, str | int] = {}
        for attr_name, attr_value in group_key:
            out_key = _EAP_ATTR_TO_OUTPUT_KEY.get(attr_name)
            if out_key:
                by[out_key] = int(attr_value) if out_key == "project_id" else attr_value

        statuses = _SESSION_STATUSES if has_status_groupby else (None,)
        for status in statuses:
            series_data: dict[_FieldSpec, list[float | None]] = {}
            totals_data: dict[_FieldSpec, float | None] = {}
            for spec in fields:
                if status is not None:
                    s, t = _extract_for_status(spec, status, label_data, num_buckets)
                else:
                    s, t = _extract(spec, label_data, num_buckets)
                series_data[spec] = s
                totals_data[spec] = t

            group: dict = {}
            if include_series:
                group["series"] = {
                    field_alias_map[spec]: [float(v) if v is not None else None for v in vals]
                    for spec, vals in series_data.items()
                }
            if include_totals:
                group["totals"] = {
                    field_alias_map[spec]: float(v) if v is not None else None
                    for spec, v in totals_data.items()
                }
            group["by"] = {**by, "session.status": status} if status is not None else by
            result_groups.append(group)

    return {
        "start": isoformat_z(start),
        "end": isoformat_z(end),
        "intervals": intervals,
        "groups": result_groups,
        "query": "",
    }


def is_session_metrics_query(metrics_query: DeprecatingMetricsQuery) -> bool:
    """Check if a DeprecatingMetricsQuery targets session metrics."""
    return any(field.metric_mri in _MRI_TO_FIELD for field in metrics_query.select)


def get_series_eap(
    metrics_query: DeprecatingMetricsQuery,
    org_id: int,
) -> dict | None:
    """Query EAP for session data matching a metrics/data endpoint query.

    Returns the result in the same format as get_series() with field names
    matching the metric aliases, or None if the query can't be translated.
    """
    fields: list[_FieldSpec] = []
    field_alias_map: dict[_FieldSpec, str] = {}

    for field in metrics_query.select:
        spec = _MRI_TO_FIELD.get(field.metric_mri)
        if spec is None:
            return None
        if spec not in field_alias_map:
            fields.append(spec)
            field_alias_map[spec] = field.alias

    raw_groupby: list[str] = []
    if metrics_query.groupby:
        for gb in metrics_query.groupby:
            gb_name = gb.name if hasattr(gb, "name") else str(gb.field)
            if gb_name == "session.status":
                raw_groupby.append("session.status")
            elif gb_name in _GROUPBY_TO_EAP:
                raw_groupby.append(gb_name)
            else:
                return None

    project_ids = list(metrics_query.project_ids)
    where = list(metrics_query.where) if metrics_query.where else []
    rollup = metrics_query.granularity.granularity

    if metrics_query.start is None or metrics_query.end is None:
        return None

    start = metrics_query.start
    end = metrics_query.end

    request = _build_eap_timeseries_request(
        org_id=org_id,
        project_ids=project_ids,
        fields=fields,
        raw_groupby=raw_groupby,
        start=start,
        end=end,
        rollup=rollup,
        where=where,
    )
    responses = timeseries_rpc([request])
    assert len(responses) == 1

    return _transform_eap_response(
        response=responses[0],
        fields=fields,
        field_alias_map=field_alias_map,
        raw_groupby=raw_groupby,
        start=start,
        end=end,
        rollup=rollup,
        include_totals=metrics_query.include_totals,
        include_series=metrics_query.include_series,
    )


_FRESHNESS_BUFFER = timedelta(minutes=30)


def _safe_bucket_cutoff(intervals: list[str | datetime]) -> int:
    """Return the number of leading buckets old enough to compare."""
    cutoff = datetime.now(timezone.utc) - _FRESHNESS_BUFFER
    count = 0
    for ts in intervals:
        if isinstance(ts, str):
            bucket_time = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            bucket_time = ts
        if bucket_time >= cutoff:
            break
        count += 1
    return count


def _groups_match(
    control_groups: list[dict],
    exp_groups: list[dict],
    cutoff: int,
) -> bool:
    """Compare groups, only looking at the first ``cutoff`` series values."""
    if len(control_groups) != len(exp_groups):
        return False

    def _sort_key(g: dict) -> list[tuple[str, str]]:
        return sorted((k, str(v)) for k, v in g.get("by", {}).items())

    control_sorted = sorted(control_groups, key=_sort_key)
    exp_sorted = sorted(exp_groups, key=_sort_key)

    for cg, eg in zip(control_sorted, exp_sorted):
        if cg.get("by") != eg.get("by"):
            return False
        c_series = cg.get("series", {})
        e_series = eg.get("series", {})
        if c_series.keys() != e_series.keys():
            return False
        for field in c_series:
            if c_series[field][:cutoff] != e_series[field][:cutoff]:
                return False
    return True


def compare_get_series_results(control: dict, experimental: dict) -> None:
    """Shadow-compare get_series results from legacy metrics and EAP."""
    control_groups = control.get("groups", [])
    exp_groups = experimental.get("groups", [])
    intervals = control.get("intervals", [])
    is_null = len(exp_groups) == 0

    cutoff = _safe_bucket_cutoff(intervals)
    if cutoff == 0:
        metrics.incr(
            "eap_sessions.get_series_compare",
            tags={"match": "skipped", "is_null_result": str(is_null)},
            sample_rate=1.0,
        )
        return

    match = _groups_match(control_groups, exp_groups, cutoff)

    if not match:
        logger.warning(
            "eap_sessions.get_series_mismatch",
            extra={
                "control_groups": control_groups,
                "eap_groups": exp_groups,
                "cutoff": cutoff,
                "total_buckets": len(intervals),
            },
        )

    metrics.incr(
        "eap_sessions.get_series_compare",
        tags={
            "match": str(match),
            "is_null_result": str(is_null),
        },
        sample_rate=1.0,
    )
