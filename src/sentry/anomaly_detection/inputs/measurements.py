"""Collect sparse, bucketed detector inputs from cell-local Snuba datasets."""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Literal

from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeries
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue, StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    TraceItemFilter,
)
from snuba_sdk import (
    And,
    BooleanCondition,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    LimitBy,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)

from sentry.anomaly_detection.contracts import Metric, SeriesRow, Signal
from sentry.search.eap.rpc_utils import and_trace_item_filters, or_trace_item_filters
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.dataset import Dataset
from sentry.snuba.rpc_dataset_common import LimitBy as SpanLimitBy
from sentry.snuba.spans_rpc import Spans
from sentry.utils import snuba_rpc
from sentry.utils.snuba import raw_snql_query

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.search.eap.resolver import SearchResolver

Interval = Literal["1m", "1h"]

MAX_ENVIRONMENTS = 8
MAX_SLICES = 10
_BUCKETS_PER_QUERY = 96
_ENVIRONMENT_LOOKBACK = timedelta(days=1)
_REFERRER = "anomaly-detection.collect"
_ROLLUPS: dict[Interval, int] = {"1m": 60, "1h": 3600}

ERROR_USER = "tags[sentry:user]"
ERROR_RELEASE = "tags[sentry:release]"
ERROR_METRICS = (Metric.COUNT, Metric.COUNT_UNIQUE_USER)
SPAN_COUNTS = (Metric.COUNT, Metric.COUNT_SAMPLE)
SPAN_LATENCY = (*SPAN_COUNTS, Metric.P95_DURATION)
REQUEST_QUERY = "is_transaction:true"
FAILED_QUERY = f"{REQUEST_QUERY} http.response_status_code:>=500"


@dataclass(frozen=True)
class SpanSignal:
    name: Signal
    query: str
    dimension: str  # Span attribute that slices the signal; empty for service totals.
    metrics: tuple[Metric, ...]


SPAN_SLICES = (
    SpanSignal(
        Signal.ENDPOINTS, REQUEST_QUERY, "transaction", (*SPAN_LATENCY, Metric.FAILURE_RATE)
    ),
    SpanSignal(Signal.OUTBOUND_DB, "span.category:db", "db.name", SPAN_LATENCY),
    SpanSignal(
        Signal.OUTBOUND_HTTP,
        "span.op:http.client",
        "span.domain",
        (*SPAN_LATENCY, Metric.FAILURE_RATE),
    ),
)


class IncompleteCollection(RuntimeError):
    """A response violated a collection bound; don't advance over incomplete data."""


def _project_map(organization: Organization, projects: Sequence[Project]) -> dict[int, Project]:
    if any(project.organization_id != organization.id for project in projects):
        raise ValueError("Anomaly detection projects must belong to the organization")
    return {project.id: project for project in projects}


def _utc(value: datetime | str | int) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    elif isinstance(value, int):
        value = datetime.fromtimestamp(value, timezone.utc)
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def _number(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return float(value)
    return None


def _normalize(
    data: Sequence[SnubaRow],
    *,
    project_id: int,
    signal: Signal,
    metrics: tuple[Metric, ...],
    start: datetime,
    end: datetime,
    env: str,
    dimension: str = "",
) -> Iterator[SeriesRow]:
    for point in data:
        timestamp = _utc(point["time"])
        if not start <= timestamp < end:
            continue
        for metric in metrics:
            if metric not in point:
                continue
            value = _number(point[metric])
            if metric in (Metric.P95_DURATION, Metric.FAILURE_RATE) and not _number(
                point.get(Metric.COUNT_SAMPLE)
            ):
                value = None
            yield SeriesRow(timestamp, signal, metric, project_id, env, dimension, value)


def _windows(start: datetime, end: datetime, rollup: int) -> Iterator[tuple[datetime, datetime]]:
    width = timedelta(seconds=rollup * _BUCKETS_PER_QUERY)
    while start < end:
        boundary = min(start + width, end)
        yield start, boundary
        start = boundary


# Environment comes back nullable in the errors dataset. Use one expression for
# grouping and filtering so null and empty environment mean the same thing.
def _error_env(alias: str | None = None) -> Function:
    return Function("coalesce", [Column("environment"), ""], alias)


def _error_where(project: Project, start: datetime, end: datetime) -> list[Condition]:
    return [
        Condition(Column("project_id"), Op.EQ, project.id),
        Condition(Column("timestamp"), Op.GTE, start.replace(tzinfo=timezone.utc)),
        Condition(Column("timestamp"), Op.LT, end.replace(tzinfo=timezone.utc)),
    ]


def _run_errors(
    organization: Organization, query: Query, referrer: str = _REFERRER
) -> list[SnubaRow]:
    response = raw_snql_query(
        Request(
            dataset=Dataset.Events.value,
            app_id="errors",
            query=query,
            tenant_ids={"organization_id": organization.id},
        ),
        referrer=referrer,
    )
    return response["data"]


def _error_environments(
    organization: Organization, scope: list[Condition], limit: int
) -> list[str]:
    count = Function("count", [])
    top_envs = _run_errors(
        organization,
        Query(
            match=Entity("events"),
            select=[count],
            where=scope,
            groupby=[_error_env("env")],
            orderby=[OrderBy(count, Direction.DESC), OrderBy(Column("env"), Direction.ASC)],
            limit=Limit(limit),
        ),
    )
    envs: list[str] = [row["env"] for row in top_envs]
    if len(envs) > limit or len(set(envs)) != len(envs):
        raise IncompleteCollection("Errors environment query exceeded its grouping bound")
    return envs


def _collect_errors(
    organization: Organization,
    project: Project,
    start: datetime,
    end: datetime,
    rollup: int,
    request_envs: tuple[str, ...],
) -> Iterator[SeriesRow]:
    scope = _error_where(project, start, end)
    count = Function("count", [])
    env = _error_env()
    env_group = _error_env("env")
    current_envs = _error_environments(organization, scope, MAX_ENVIRONMENTS)
    envs = list(dict.fromkeys([*current_envs, *request_envs]))
    prior_slots = MAX_ENVIRONMENTS - len(current_envs)
    if prior_slots:
        # Keep recently active errors-only scopes measurable through a quiet window.
        # Give current errors priority, and never let history evict a request scope.
        prior_scope = _error_where(project, start - _ENVIRONMENT_LOOKBACK, start)
        if envs:
            prior_scope.append(Condition(env, Op.NOT_IN, envs))
        prior_envs = _error_environments(organization, prior_scope, prior_slots)
        if set(prior_envs).intersection(envs):
            raise IncompleteCollection("Unexpected prior error environment")
        envs = [*envs, *prior_envs]
    if not envs:
        return
    release = Column(ERROR_RELEASE)
    top_releases = (
        _run_errors(
            organization,
            Query(
                match=Entity("events"),
                select=[count],
                where=[*scope, Condition(env, Op.IN, current_envs), Condition(release, Op.NEQ, "")],
                groupby=[env_group, release],
                orderby=[OrderBy(count, Direction.DESC), OrderBy(release, Direction.ASC)],
                limitby=LimitBy([Column("env")], MAX_SLICES),
                limit=Limit(len(current_envs) * MAX_SLICES + 1),
            ),
        )
        if current_envs
        else []
    )
    releases: dict[str, list[str]] = defaultdict(list)
    for row in top_releases:
        if row["env"] not in current_envs:
            raise IncompleteCollection("Unexpected release environment")
        if row[ERROR_RELEASE]:
            releases[row["env"]].append(row[ERROR_RELEASE])
    if len(top_releases) > len(current_envs) * MAX_SLICES or any(
        len(group) > MAX_SLICES for group in releases.values()
    ):
        raise IncompleteCollection("Errors release query exceeded grouping bound")

    release_groups = {(name, value) for name, values in releases.items() for value in values}
    release_conditions = [
        And([Condition(env, Op.EQ, name), Condition(release, Op.IN, values)])
        for name, values in releases.items()
    ]
    queries: list[
        tuple[Signal, list[Column | Function], Condition | BooleanCondition, set[tuple[str, str]]]
    ] = [
        (Signal.ERRORS, [env_group], Condition(env, Op.IN, envs), {(name, "") for name in envs}),
    ]
    if release_conditions:
        release_where = (
            Or(release_conditions) if len(release_conditions) > 1 else release_conditions[0]
        )
        queries.append(
            (Signal.ERRORS_BY_RELEASE, [env_group, release], release_where, release_groups)
        )

    step = timedelta(seconds=rollup)
    bucket = Column("time")
    # Snuba's distinct count ignores empty user tags without dropping those errors from count().
    users = Function("uniq", [Column(ERROR_USER)], "users")
    for left, right in _windows(start, end, rollup):
        bucket_count = (right - left) // step
        # Use native time grouping. Only fill empty buckets for scopes the
        # successful, bounded query actually covered.
        where = _error_where(project, left, right)
        for signal, groups, condition, allowed in queries:
            cap = len(allowed) * bucket_count
            result = _run_errors(
                organization,
                Query(
                    match=Entity("events"),
                    select=[count, users],
                    where=[*where, condition],
                    groupby=[bucket, *groups],
                    granularity=Granularity(rollup),
                    limit=Limit(cap + 1),
                ),
            )
            if len(result) > cap:
                raise IncompleteCollection("Errors time series exceeded its row bound")
            seen: set[tuple[datetime, str, str]] = set()
            for row in result:
                timestamp = _utc(row["time"])
                name, dimension = row["env"], row.get(ERROR_RELEASE) or ""
                key = (timestamp, name, dimension)
                if not left <= timestamp < right or (timestamp - left) % step:
                    raise IncompleteCollection("Unexpected error time series timestamp")
                if (name, dimension) not in allowed or key in seen:
                    raise IncompleteCollection("Unexpected or duplicate error time series bucket")
                seen.add(key)
                point = {
                    "time": timestamp,
                    Metric.COUNT: row.get("count()"),
                    Metric.COUNT_UNIQUE_USER: row.get("users"),
                }
                yield from _normalize(
                    [point],
                    project_id=project.id,
                    signal=signal,
                    metrics=ERROR_METRICS,
                    start=left,
                    end=right,
                    env=name,
                    dimension=dimension,
                )
            covered_groups = sorted(allowed)
            for index in range(bucket_count):
                timestamp = left + index * step
                for name, dimension in covered_groups:
                    if (timestamp, name, dimension) not in seen:
                        for metric in ERROR_METRICS:
                            yield SeriesRow(
                                timestamp, signal, metric, project.id, name, dimension, 0.0
                            )


def _span_attribute_filter(
    resolver: SearchResolver, field: str, values: tuple[str, ...]
) -> TraceItemFilter | None:
    attribute, _ = resolver.resolve_attribute(field)
    key = attribute.proto_definition
    nonempty = [value for value in values if value]
    filters: list[TraceItemFilter] = []
    if nonempty:
        filters.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=key,
                    op=ComparisonFilter.OP_IN,
                    value=AttributeValue(val_str_array=StrArray(values=nonempty)),
                )
            )
        )
    if "" in values:
        filters.extend(
            (
                TraceItemFilter(
                    not_filter=NotFilter(
                        filters=[TraceItemFilter(exists_filter=ExistsFilter(key=key))]
                    )
                ),
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=key, op=ComparisonFilter.OP_EQUALS, value=AttributeValue(val_str="")
                    )
                ),
            )
        )
    return or_trace_item_filters(*filters)


@dataclass(frozen=True, kw_only=True)
class ScopedSpans(SearchResolverConfig):
    filters: tuple[tuple[str, tuple[str, ...]], ...] = ()
    named_dimension: str = ""
    stable_timestamp_quantization: bool = False
    zerofill_timeseries: bool = False

    def extra_conditions(
        self,
        search_resolver: SearchResolver,
        selected_columns: list[str] | None,
        equations: list[str] | None,
    ) -> TraceItemFilter | None:
        filters = [
            _span_attribute_filter(search_resolver, field, values) for field, values in self.filters
        ]
        if self.named_dimension:
            attribute, _ = search_resolver.resolve_attribute(self.named_dimension)
            key = attribute.proto_definition
            filters.extend(
                [
                    TraceItemFilter(exists_filter=ExistsFilter(key=key)),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_NOT_EQUALS,
                            value=AttributeValue(val_str=""),
                        )
                    ),
                ]
            )
        return and_trace_item_filters(*filters)


def _span_groups(
    params: SnubaParams,
    query: str,
    *,
    dimension: str = "",
    envs: tuple[str, ...] | None = None,
) -> list[tuple[str, ...]]:
    if envs == ():
        return []
    fields = ["environment"]
    partitioned = envs is not None
    if partitioned:
        fields.append(dimension)
    limit = len(envs) * MAX_SLICES if envs is not None else MAX_ENVIRONMENTS
    response = Spans.run_table_query(
        params=params,
        query_string=query,
        selected_columns=[*fields, "count()"],
        orderby=["-count()", *fields],
        offset=0,
        limit=limit + partitioned,
        referrer=_REFERRER,
        config=ScopedSpans(
            filters=(("environment", envs),) if envs is not None else (), named_dimension=dimension
        ),
        limit_by=SpanLimitBy(columns=["environment"], limit=MAX_SLICES) if partitioned else None,
    )
    data = response["data"]
    groups: list[tuple[str, ...]] = list(
        dict.fromkeys(tuple(row.get(field) or "" for field in fields) for row in data)
    )
    token = response.get("page_token")
    if len(data) > limit or (partitioned and token is not None and not token.end_pagination):
        raise IncompleteCollection("Spans group discovery exceeded its partition limit")
    if envs is not None and any(group[0] not in envs or not group[1] for group in groups):
        raise IncompleteCollection("Unexpected Spans slice group")
    return groups


def _span_series(
    organization: Organization,
    project: Project,
    start: datetime,
    end: datetime,
    rollup: int,
    signal: SpanSignal,
    groups: list[tuple[str, ...]],
    *,
    positive_requests: set[tuple[datetime, str]] | None = None,
) -> Iterator[SeriesRow]:
    # The timeseries RPC can stringify a null group as "None". Filter the
    # missing/empty scope separately and don't group it by environment.
    for missing in (False, True):
        scoped_groups = [group for group in groups if (group[0] == "") == missing]
        if scoped_groups:
            yield from _scoped_span_series(
                organization,
                project,
                start,
                end,
                rollup,
                signal,
                scoped_groups,
                missing=missing,
                positive_requests=positive_requests,
            )


def _scoped_span_series(
    organization: Organization,
    project: Project,
    start: datetime,
    end: datetime,
    rollup: int,
    signal: SpanSignal,
    groups: list[tuple[str, ...]],
    *,
    missing: bool,
    positive_requests: set[tuple[datetime, str]] | None,
) -> Iterator[SeriesRow]:
    allowed = set(groups)
    fields = ["environment", signal.dimension] if signal.dimension else ["environment"]
    config = ScopedSpans()
    for left, right in _windows(start, end, rollup):
        params = SnubaParams(
            organization=organization,
            projects=[project],
            start=left,
            end=right,
            granularity_secs=rollup,
        )
        resolver = Spans.get_resolver(params, config)
        conditions = or_trace_item_filters(
            *(
                and_trace_item_filters(
                    *(
                        _span_attribute_filter(resolver, field, (value,))
                        for field, value in zip(fields, group)
                    )
                )
                for group in groups
            )
        )
        request, _, columns = Spans.get_timeseries_query(
            search_resolver=resolver,
            params=params,
            query_string=signal.query,
            y_axes=[metric.value for metric in signal.metrics],
            groupby=fields[1:] if missing else fields,
            referrer=_REFERRER,
            sampling_mode=None,
            extra_conditions=conditions,
        )
        response = snuba_rpc.timeseries_rpc([request])[0]
        grouped: dict[tuple[str, ...], list[TimeSeries]] = defaultdict(list)
        bucket_count = int((right - left).total_seconds() / rollup)
        for series in response.result_timeseries:
            attributes = series.group_by_attributes
            key = tuple(attributes.get(column.internal_name, "") for column in columns)
            if missing:
                key = ("", *key)
            if key not in allowed:
                raise IncompleteCollection("Unexpected group in Spans time series")
            if series.label not in signal.metrics or len(series.buckets) > bucket_count:
                raise IncompleteCollection("Unexpected metric or bucket count in Spans time series")
            if len(series.buckets) != len(series.data_points):
                raise IncompleteCollection(
                    "Spans time series did not return a value for every bucket"
                )
            grouped[key].append(series)
        present: set[tuple[datetime, str]] = set()
        for key, group_series in grouped.items():
            if len(group_series) != len({item.label for item in group_series}):
                raise IncompleteCollection("Duplicate group/metric in Spans time series")
            data = Spans.process_timeseries_list(group_series, config).timeseries
            if not signal.dimension:
                # EAP emits a placeholder with null for every aggregate in an
                # empty bucket. Missing or partially populated metrics remain
                # unknown rather than being synthesized as zero.
                data = [
                    point
                    for point in data
                    if not all(
                        metric in point and point[metric] is None for metric in signal.metrics
                    )
                ]
            if not signal.dimension:
                present.update((_utc(point["time"]), key[0]) for point in data)
            yield from _normalize(
                data,
                project_id=project.id,
                signal=signal.name,
                metrics=signal.metrics,
                start=left,
                end=right,
                env=key[0],
                dimension=key[1] if signal.dimension else "",
            )
        if not signal.dimension:
            for index in range(bucket_count):
                timestamp = left + timedelta(seconds=index * rollup)
                for (env,) in groups:
                    bucket = timestamp, env
                    if bucket in present or (
                        positive_requests is not None and bucket not in positive_requests
                    ):
                        continue
                    for metric in signal.metrics:
                        yield SeriesRow(timestamp, signal.name, metric, project.id, env, "", 0.0)


def collect(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
    interval: Interval,
) -> list[SeriesRow]:
    """Collect measurements in [start, end), with bucket-aligned naive UTC timestamps.

    Group discovery bounds the active environments and slices. Only covered
    request and error scopes can report zero; query failures propagate.
    """
    rollup = _ROLLUPS[interval]
    start, end = _utc(start), _utc(end)
    if start >= end:
        return []
    if any(
        value.microsecond or int(value.replace(tzinfo=timezone.utc).timestamp()) % rollup
        for value in (start, end)
    ):
        raise ValueError("Anomaly collection window must align with its bucket boundaries")

    rows: list[SeriesRow] = []
    for project in _project_map(organization, projects).values():
        spans_enabled = Spans.filter_project(project)
        request_groups = []
        if spans_enabled:
            # Discover traffic scopes even when the collection window itself is silent.
            discovery = SnubaParams(
                organization=organization,
                projects=[project],
                start=start - _ENVIRONMENT_LOOKBACK,
                end=end,
            )
            request_groups = _span_groups(discovery, REQUEST_QUERY)
        request_envs = tuple(group[0] for group in request_groups)
        rows.extend(_collect_errors(organization, project, start, end, rollup, request_envs))
        if not spans_enabled:
            continue
        params = SnubaParams(organization=organization, projects=[project], start=start, end=end)
        requests = list(
            _span_series(
                organization,
                project,
                start,
                end,
                rollup,
                SpanSignal(Signal.REQUESTS, REQUEST_QUERY, "", SPAN_COUNTS),
                request_groups,
            )
        )
        rows.extend(requests)
        positive_requests = {
            (row.ts, row.env)
            for row in requests
            if row.metric == Metric.COUNT and row.value is not None and row.value > 0
        }
        rows.extend(
            _span_series(
                organization,
                project,
                start,
                end,
                rollup,
                SpanSignal(Signal.FAILED_REQUESTS, FAILED_QUERY, "", SPAN_COUNTS),
                request_groups,
                positive_requests=positive_requests,
            )
        )
        for signal in SPAN_SLICES:
            if signal.query == REQUEST_QUERY:
                environments = request_envs
            else:
                environments = tuple(
                    group[0]
                    for group in _span_groups(params, signal.query, dimension=signal.dimension)
                )
            slices = _span_groups(
                params, signal.query, dimension=signal.dimension, envs=environments
            )
            rows.extend(_span_series(organization, project, start, end, rollup, signal, slices))
    return rows
