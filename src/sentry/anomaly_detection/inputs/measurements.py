"""Collect sparse, bucketed detector inputs from cell-local Snuba datasets."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Literal

import msgspec
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeries
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
)

from sentry.anomaly_detection.contracts import Metric, SeriesRow, Signal
from sentry.anomaly_detection.inputs.query import (
    ScopedSpans,
    error_env,
    error_where,
    number,
    project_map,
    run_errors,
    span_attribute_filter,
    utc,
)
from sentry.anomaly_detection.state import client, org_key
from sentry.search.eap.rpc_utils import and_trace_item_filters, or_trace_item_filters
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import LimitBy as SpanLimitBy
from sentry.snuba.spans_rpc import Spans
from sentry.utils import snuba_rpc

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

Interval = Literal["1m", "1h"]

MAX_ENVIRONMENTS = 8
MAX_SLICES = 10
_BUCKETS_PER_QUERY = 96
_ENVIRONMENT_LOOKBACK = timedelta(days=1)
# Environment discovery scans the lookback; minute runs reuse it this long. The
# current window is always queried too, so only quiet-window coverage of a
# brand-new environment can lag by up to this TTL.
_ENVIRONMENT_CACHE_TTL = 600
_REFERRER = Referrer.ANOMALY_DETECTION_COLLECT.value
_ROLLUPS: dict[Interval, int] = {"1m": 60, "1h": 3600}

ERROR_USER = "tags[sentry:user]"
ERROR_RELEASE = "tags[sentry:release]"
ERROR_METRICS = (Metric.COUNT, Metric.COUNT_UNIQUE_USER)
SPAN_COUNTS = (Metric.COUNT, Metric.COUNT_SAMPLE)
SPAN_LATENCY = (*SPAN_COUNTS, Metric.P95_DURATION)
# The query aggregate of each collected metric, also its key in returned points.
AGGREGATES = {
    Metric.COUNT: "count()",
    Metric.COUNT_SAMPLE: "count_sample()",
    Metric.COUNT_UNIQUE_USER: "count_unique(user)",
    Metric.P95_DURATION: "p95(span.duration)",
    Metric.FAILURE_RATE: "failure_rate()",
}
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


def _environment_key(
    organization: Organization, project: Project, dataset: str, rollup: int
) -> str:
    return org_key(organization.id, "environments", "v1", str(project.id), dataset, str(rollup))


def _cached_inventory[T](key: str, type_: type[T]) -> T | None:
    value = client().get(key)
    if value is None:
        return None
    try:
        return msgspec.msgpack.decode(value, type=type_)
    except msgspec.DecodeError:
        return None


def _cache_inventory(key: str, inventory: object) -> None:
    client().set(key, msgspec.msgpack.encode(inventory), ex=_ENVIRONMENT_CACHE_TTL)


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
        timestamp = utc(point["time"])
        if not start <= timestamp < end:
            continue
        for metric in metrics:
            aggregate = AGGREGATES[metric]
            if aggregate not in point:
                continue
            value = number(point[aggregate])
            if metric in (Metric.P95_DURATION, Metric.FAILURE_RATE) and not number(
                point.get(AGGREGATES[Metric.COUNT_SAMPLE])
            ):
                value = None
            yield SeriesRow(timestamp, project_id, env, signal, metric, dimension, value)


def _windows(start: datetime, end: datetime, rollup: int) -> Iterator[tuple[datetime, datetime]]:
    width = timedelta(seconds=rollup * _BUCKETS_PER_QUERY)
    while start < end:
        boundary = min(start + width, end)
        yield start, boundary
        start = boundary


def _error_environments(
    organization: Organization, scope: list[Condition], limit: int
) -> list[str]:
    count = Function("count", [])
    top_envs = run_errors(
        organization,
        Query(
            match=Entity("events"),
            select=[count],
            where=scope,
            groupby=[error_env("env")],
            orderby=[OrderBy(count, Direction.DESC), OrderBy(Column("env"), Direction.ASC)],
            limit=Limit(limit),
        ),
        _REFERRER,
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
    scope = error_where(project, start, end)
    count = Function("count", [])
    env = error_env()
    env_group = error_env("env")
    current_envs = _error_environments(organization, scope, MAX_ENVIRONMENTS)
    envs = list(dict.fromkeys([*current_envs, *request_envs]))
    prior_slots = MAX_ENVIRONMENTS - len(current_envs)
    if prior_slots:
        # Keep recently active errors-only scopes measurable through a quiet window.
        # Give current errors priority, and never let history evict a request scope.
        # Fill the slots from a cached inventory ranked without excluding those
        # scopes: at most MAX_ENVIRONMENTS current and request scopes each can
        # precede the prior ones, so twice the bound always fills every slot.
        cache_key = _environment_key(organization, project, "errors", rollup)
        inventory = _cached_inventory(cache_key, list[str])
        if inventory is None:
            inventory = _error_environments(
                organization,
                error_where(project, start - _ENVIRONMENT_LOOKBACK, end),
                2 * MAX_ENVIRONMENTS,
            )
            _cache_inventory(cache_key, inventory)
        covered = set(envs)
        envs.extend([name for name in inventory if name not in covered][:prior_slots])
    if not envs:
        return
    release = Column(ERROR_RELEASE)
    release_cap = len(current_envs) * MAX_SLICES
    top_releases: list[SnubaRow] = []
    if current_envs:
        top_releases = run_errors(
            organization,
            Query(
                match=Entity("events"),
                select=[count],
                where=[*scope, Condition(env, Op.IN, current_envs), Condition(release, Op.NEQ, "")],
                groupby=[env_group, release],
                orderby=[OrderBy(count, Direction.DESC), OrderBy(release, Direction.ASC)],
                limitby=LimitBy([Column("env")], MAX_SLICES),
                limit=Limit(release_cap + 1),
            ),
            _REFERRER,
        )
    releases: dict[str, list[str]] = defaultdict(list)
    for row in top_releases:
        if row["env"] not in current_envs:
            raise IncompleteCollection("Unexpected release environment")
        if row[ERROR_RELEASE]:
            releases[row["env"]].append(row[ERROR_RELEASE])
    if len(top_releases) > release_cap or any(
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
        where = error_where(project, left, right)
        for signal, groups, condition, allowed in queries:
            cap = len(allowed) * bucket_count
            result = run_errors(
                organization,
                Query(
                    match=Entity("events"),
                    select=[count, users],
                    where=[*where, condition],
                    groupby=[bucket, *groups],
                    granularity=Granularity(rollup),
                    limit=Limit(cap + 1),
                ),
                _REFERRER,
            )
            if len(result) > cap:
                raise IncompleteCollection("Errors time series exceeded its row bound")
            seen: set[tuple[datetime, str, str]] = set()
            for row in result:
                timestamp = utc(row["time"])
                name, dimension = row["env"], row.get(ERROR_RELEASE) or ""
                key = (timestamp, name, dimension)
                if not left <= timestamp < right or (timestamp - left) % step:
                    raise IncompleteCollection("Unexpected error time series timestamp")
                if (name, dimension) not in allowed or key in seen:
                    raise IncompleteCollection("Unexpected or duplicate error time series bucket")
                seen.add(key)
                point = {
                    "time": timestamp,
                    AGGREGATES[Metric.COUNT]: row.get("count()"),
                    AGGREGATES[Metric.COUNT_UNIQUE_USER]: row.get("users"),
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
                                timestamp, project.id, name, signal, metric, dimension, 0.0
                            )


def _span_environments(params: SnubaParams, query: str, *, dimension: str = "") -> dict[str, float]:
    """Count the busiest environments, merging null and empty into the "" scope."""
    response = Spans.run_table_query(
        params=params,
        query_string=query,
        selected_columns=["environment", "count()"],
        orderby=["-count()", "environment"],
        offset=0,
        limit=MAX_ENVIRONMENTS,
        referrer=_REFERRER,
        config=ScopedSpans(named_dimension=dimension),
    )
    counts: dict[str, float] = defaultdict(float)
    for row in response["data"]:
        counts[row.get("environment") or ""] += number(row.get("count()")) or 0.0
    return dict(counts)


def _request_environments(
    organization: Organization, project: Project, start: datetime, end: datetime, rollup: int
) -> tuple[str, ...]:
    """Rank request scopes over the lookback, so a silent window still reports zeros."""
    key = _environment_key(organization, project, "spans", rollup)
    cached = _cached_inventory(key, list[tuple[str, float]])
    if cached is None:
        discovery = SnubaParams(
            organization=organization,
            projects=[project],
            start=start - _ENVIRONMENT_LOOKBACK,
            end=end,
        )
        counts = _span_environments(discovery, REQUEST_QUERY)
        _cache_inventory(key, list(counts.items()))
    else:
        # Merge the current window so the cache never delays a new environment.
        current = SnubaParams(organization=organization, projects=[project], start=start, end=end)
        counts = defaultdict(float, cached)
        for env, count in _span_environments(current, REQUEST_QUERY).items():
            counts[env] += count
    return tuple(sorted(counts, key=lambda env: (-counts[env], env))[:MAX_ENVIRONMENTS])


def _span_slices(
    params: SnubaParams, query: str, dimension: str, envs: tuple[str, ...]
) -> list[tuple[str, ...]]:
    if not envs:
        return []
    fields = ["environment", dimension]
    limit = len(envs) * MAX_SLICES
    response = Spans.run_table_query(
        params=params,
        query_string=query,
        selected_columns=[*fields, "count()"],
        orderby=["-count()", *fields],
        offset=0,
        limit=limit + 1,
        referrer=_REFERRER,
        config=ScopedSpans(filters=(("environment", envs),), named_dimension=dimension),
        limit_by=SpanLimitBy(columns=["environment"], limit=MAX_SLICES),
    )
    data = response["data"]
    groups: list[tuple[str, ...]] = list(
        dict.fromkeys(tuple(row.get(field) or "" for field in fields) for row in data)
    )
    # LIMIT BY partitions null and empty environments separately, but both
    # collapse to the "" scope, so the extra row detects an overflowing bound.
    if len(data) > limit:
        raise IncompleteCollection("Spans group discovery exceeded its partition limit")
    if any(group[0] not in envs or not group[1] for group in groups):
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
                        span_attribute_filter(resolver, field, (value,))
                        for field, value in zip(fields, group)
                    )
                )
                for group in groups
            )
        )
        aggregates = [AGGREGATES[metric] for metric in signal.metrics]
        request, _, columns = Spans.get_timeseries_query(
            search_resolver=resolver,
            params=params,
            query_string=signal.query,
            y_axes=aggregates,
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
            if series.label not in aggregates or len(series.buckets) > bucket_count:
                raise IncompleteCollection("Unexpected metric or bucket count in Spans time series")
            if len(series.buckets) != len(series.data_points):
                raise IncompleteCollection(
                    "Spans time series did not return a value for every bucket"
                )
            grouped[key].append(series)
        present: set[tuple[datetime, tuple[str, ...]]] = set()
        for key, group_series in grouped.items():
            if len(group_series) != len({item.label for item in group_series}):
                raise IncompleteCollection("Duplicate group/metric in Spans time series")
            # EAP emits a placeholder with null for every aggregate in an empty bucket.
            # Missing or partially populated metrics remain unknown rather than being
            # synthesized as zero.
            data = [
                point
                for point in Spans.process_timeseries_list(group_series, config).timeseries
                if not all(
                    aggregate in point and point[aggregate] is None for aggregate in aggregates
                )
            ]
            present.update((utc(point["time"]), key) for point in data)
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
        # Every covered slice was measured in every bucket: no traffic counts 0, and
        # its latency and failure share are unknown.
        for index in range(bucket_count):
            timestamp = left + timedelta(seconds=index * rollup)
            for group in groups:
                if (timestamp, group) in present or (
                    positive_requests is not None and (timestamp, group[0]) not in positive_requests
                ):
                    continue
                for metric in signal.metrics:
                    yield SeriesRow(
                        timestamp,
                        project.id,
                        group[0],
                        signal.name,
                        metric,
                        group[1] if signal.dimension else "",
                        0.0 if metric.is_count else None,
                    )


def collect(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
    interval: Interval,
) -> list[SeriesRow]:
    """Collect measurements in [start, end), with bucket-aligned UTC timestamps.

    Group discovery bounds the active environments and slices. Only covered
    request and error scopes can report zero; query failures propagate.
    """
    rollup = _ROLLUPS[interval]
    start, end = utc(start), utc(end)
    if start >= end:
        return []
    if any(value.microsecond or int(value.timestamp()) % rollup for value in (start, end)):
        raise ValueError("Anomaly collection window must align with its bucket boundaries")

    rows: list[SeriesRow] = []
    for project in project_map(organization, projects).values():
        spans_enabled = Spans.filter_project(project)
        # Discover traffic scopes even when the collection window itself is silent.
        request_envs = (
            _request_environments(organization, project, start, end, rollup)
            if spans_enabled
            else ()
        )
        rows.extend(_collect_errors(organization, project, start, end, rollup, request_envs))
        if not spans_enabled:
            continue
        request_groups: list[tuple[str, ...]] = [(env,) for env in request_envs]
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
                    _span_environments(params, signal.query, dimension=signal.dimension)
                )
            slices = _span_slices(params, signal.query, signal.dimension, environments)
            rows.extend(_span_series(organization, project, start, end, rollup, signal, slices))
    return rows
