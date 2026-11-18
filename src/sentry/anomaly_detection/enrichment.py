"""Bounded structural evidence and new error issue discovery for the detector."""

from __future__ import annotations

import math
import re
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import TYPE_CHECKING

from snuba_sdk import Column, Condition, Direction, Entity, Function, Limit, Op, OrderBy, Query

from sentry.anomaly_detection.collection import (
    ERROR_RELEASE,
    ERROR_USER,
    FAILED_QUERY,
    MAX_ENVIRONMENTS,
    REQUEST_QUERY,
    SPAN_SLICES,
    Row,
    ScopedSpans,
    _error_env,
    _error_where,
    _number,
    _project_map,
    _run_errors,
    _utc,
)
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey
from sentry.anomaly_detection.footprint import Footprint, SliceStats, base_signal
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.spans_rpc import Spans

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

_TRACE = "contexts[trace.trace_id]"
_REFERRER = "anomaly-detection.enrich"
_TRACE_SAMPLE = 20
_TRACE_SPAN_LIMIT = 300
_MAX_FOOTPRINTS = 32
_TRACE_ID = re.compile(r"[0-9a-f]{32}", re.IGNORECASE)
_ERROR_SIGNALS = frozenset({"errors", "error_rate", "errors_by_release", "new_issue"})
_SPAN_BY_NAME = {signal.name: signal for signal in SPAN_SLICES}
_ISSUE_LIFETIME = timedelta(hours=1)
_MAX_NEW_GROUPS = 100  # candidate groups per project
_MAX_NEW_FAMILIES = 25  # queried families per project/environment
_MAX_ISSUE_EVENTS = 500  # earliest events per family
_MIN_NEW_USERS = 10


def _traces(rows: Sequence[SnubaRow], field: str) -> list[str]:
    return sorted(
        {
            value.lower()
            for row in rows
            if isinstance(value := row.get(field), str) and _TRACE_ID.fullmatch(value)
        }
    )


def _issue_ids(change: ChangeEvent) -> list[int]:
    ids = next(
        (s.removeprefix("issues:") for s in change.evidence if s.startswith("issues:")),
        change.key.dim_value,
    )
    return [
        int(value)
        for value in ids.split(",", _MAX_NEW_GROUPS)[:_MAX_NEW_GROUPS]
        if value.isascii() and value.isdigit() and len(value) <= 19
    ]


class TraceLookup:
    """Correlator footprint source. Scope the sample to the change before expanding its traces."""

    def __init__(self, organization: Organization, projects: Sequence[Project]) -> None:
        self.organization = organization
        self.projects = _project_map(organization, projects)
        self.span_projects = [
            project for project in self.projects.values() if Spans.filter_project(project)
        ]
        self.cache: dict[tuple[SeriesKey, ChangeType, datetime, datetime], Footprint | None] = {}

    def footprint(self, change: ChangeEvent) -> Footprint | None:
        if change.change_type in {ChangeType.DROP, ChangeType.SILENCE} or not self.span_projects:
            return None
        project = self.projects.get(change.key.project)
        if project is None:
            return None
        detected = _utc(change.detected_at or change.start)
        onset = _utc(change.start)
        start = onset - timedelta(minutes=1)
        end = min(
            max(detected, onset + timedelta(minutes=3)), onset + timedelta(minutes=15)
        ) + timedelta(minutes=1)
        cache_key = (change.key, change.change_type, start, end)
        if cache_key in self.cache:
            return self.cache[cache_key]
        if len(self.cache) >= _MAX_FOOTPRINTS:
            return None
        self.cache[cache_key] = self._lookup(change, project, start, end)
        return self.cache[cache_key]

    def _span_rows(
        self,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
        *,
        query: str,
        columns: list[str],
        orderby: list[str],
        limit: int,
        filters: tuple[tuple[str, tuple[str, ...]], ...],
    ) -> list[SnubaRow]:
        return Spans.run_table_query(
            params=SnubaParams(
                organization=self.organization, projects=projects, start=start, end=end
            ),
            query_string=query,
            selected_columns=columns,
            orderby=orderby,
            offset=0,
            limit=limit,
            referrer=_REFERRER,
            config=ScopedSpans(filters=filters, disable_aggregate_extrapolation=True),
            sampling_mode="HIGHEST_ACCURACY",
        )["data"]

    def _sample_spans(
        self,
        project: Project,
        env: str,
        start: datetime,
        end: datetime,
        query: str,
        filters: tuple[tuple[str, tuple[str, ...]], ...] = (),
    ) -> list[str]:
        if project not in self.span_projects:
            return []
        rows = self._span_rows(
            [project],
            start,
            end,
            query=query,
            columns=["trace", "span.duration"],
            orderby=["-span.duration", "trace"],
            limit=_TRACE_SAMPLE,
            filters=(("environment", (env,)), *filters),
        )
        return _traces(rows, "trace")

    def _lookup(
        self, change: ChangeEvent, project: Project, start: datetime, end: datetime
    ) -> Footprint | None:
        key = change.key
        name = base_signal(key.signal)
        if name in _ERROR_SIGNALS:
            conditions = [
                *_error_where(project, start, end),
                Condition(_error_env(), Op.EQ, key.env),
            ]
            if name == "new_issue":
                ids = _issue_ids(change)
                if not ids:
                    return None
                conditions.append(Condition(Column("group_id"), Op.IN, ids))
            elif name == "errors_by_release":
                conditions.append(Condition(Column(ERROR_RELEASE), Op.EQ, key.dim_value))
            traces = _traces(
                _run_errors(
                    self.organization,
                    Query(
                        match=Entity("events"),
                        select=[Column(_TRACE)],
                        where=conditions,
                        orderby=[
                            OrderBy(Column("timestamp"), Direction.DESC),
                            OrderBy(Column("event_id"), Direction.ASC),
                        ],
                        limit=Limit(_TRACE_SAMPLE),
                    ),
                    _REFERRER,
                ),
                _TRACE,
            )
            if traces:
                result = self._build(key, traces, start, end)
                if result.slices:
                    return result
            count = Function("count", [])
            transaction = Column("transaction")
            rows = _run_errors(
                self.organization,
                Query(
                    match=Entity("events"),
                    select=[count],
                    where=conditions,
                    groupby=[transaction],
                    orderby=[OrderBy(count, Direction.DESC), OrderBy(transaction, Direction.ASC)],
                    limit=Limit(3),
                ),
                _REFERRER,
            )
            transactions = tuple(row["transaction"] for row in rows if row["transaction"])
            if transactions and (
                fallback := self._sample_spans(
                    project, key.env, start, end, REQUEST_QUERY, (("transaction", transactions),)
                )
            ):
                result = self._build(key, fallback, start, end)
                result.via = "failing transactions"
                return result if result.slices else None
            return None

        filters: tuple[tuple[str, tuple[str, ...]], ...]
        if (signal := _SPAN_BY_NAME.get(name)) is not None:
            query = signal.query
            filters = ((signal.dimension, (key.dim_value,)),)
            if key.metric == "failure_rate()":
                query += " !span.status:[ok,cancelled,unknown]"
        elif name == "requests":
            query, filters = REQUEST_QUERY, ()
        elif name in {"failed_requests", "failed_rate"}:
            query, filters = FAILED_QUERY, ()
        else:
            return None
        traces = self._sample_spans(project, key.env, start, end, query, filters)
        return self._build(key, traces, start, end) if traces else None

    def _build(
        self, key: SeriesKey, traces: list[str], start: datetime, end: datetime
    ) -> Footprint:
        footprint = Footprint(event=key, traces=traces, window=(start, end))
        filters = (("trace", tuple(traces)),)
        scope = ["project.id", "environment"]
        aggregates = ["count_unique(trace)", "p95(span.duration)", "count_sample()"]
        footprint_queries = [
            ("", REQUEST_QUERY, ""),
            *((s.name, s.query, s.dimension) for s in SPAN_SLICES),
        ]
        for signal, query, dimension in footprint_queries:
            fields = [*scope, dimension] if dimension else scope
            rows = self._span_rows(
                self.span_projects,
                start,
                end,
                query=query,
                columns=[*fields, *aggregates],
                orderby=["-count_unique(trace)", *fields],
                limit=100,
                filters=filters,
            )
            for row in rows:
                project, env = str(row["project.id"]), row.get("environment") or ""
                dim = row.get(dimension) or "" if dimension else ""
                count = _number(row.get("count_sample()"))
                touched = _number(row.get("count_unique(trace)"))
                if project in self.projects and (not dimension or dim) and count and touched:
                    footprint.slices[(project, env, signal, dim)] = SliceStats(
                        min(touched / len(traces), 1.0),
                        _number(row.get("p95(span.duration)")),
                        int(count),
                    )
        # A span ID is only unique within its trace. Join HTTP client spans to
        # transactions by (trace, parent) rather than domain/transaction names.
        calls = self._span_rows(
            self.span_projects,
            start,
            end,
            query="span.op:http.client",
            columns=[*scope, "trace", "span_id", "span.domain"],
            orderby=["trace", "span_id"],
            limit=_TRACE_SPAN_LIMIT,
            filters=filters,
        )
        transactions = self._span_rows(
            self.span_projects,
            start,
            end,
            query=REQUEST_QUERY,
            columns=[*scope, "trace", "span_id", "parent_span"],
            orderby=["trace", "span_id"],
            limit=_TRACE_SPAN_LIMIT,
            filters=filters,
        )
        callers = {
            (row["trace"], row["span_id"]): (_service(row), row["span.domain"])
            for row in calls
            if row.get("span_id")
            and row.get("span.domain")
            and str(row["project.id"]) in self.projects
        }
        joined = set()
        for row in transactions:
            if str(row["project.id"]) not in self.projects:
                continue
            child = (row["trace"], row["span_id"])
            if child in joined:
                continue
            if (caller := callers.get((row["trace"], row.get("parent_span")))) is not None:
                footprint.edges[(*caller, _service(row))] += 1
                joined.add(child)
        return footprint


def _service(row: SnubaRow) -> str:
    return f"{row['project.id']}/{row.get('environment') or ''}"


def new_failure_thresholds(hourly_rows: Sequence[Row]) -> dict[tuple[str, str], float]:
    """Scale the minimum affected-user threshold per project/environment."""
    samples: dict[tuple[str, str], list[float]] = defaultdict(list)
    for _, signal, metric, project, env, dimension, value in hourly_rows:
        if (
            signal == "errors"
            and metric == "count_unique(user)"
            and not dimension
            and value is not None
        ):
            samples[(project, env)].append(value)
    return {scope: max(_MIN_NEW_USERS, 0.05 * median(values)) for scope, values in samples.items()}


def collect_new_failure_modes(
    organization: Organization,
    projects: Sequence[Project],
    thresholds: Mapping[tuple[str, str], float],
    start: datetime,
    end: datetime,
) -> list[ChangeEvent]:
    """Find new failure modes and weaker corroborating issues in [start, end)."""
    projects_by_id = _project_map(organization, projects)
    start, end = _utc(start), _utc(end)
    changes: list[ChangeEvent] = []
    if start >= end:
        return changes
    for project_id, project in projects_by_id.items():
        environments = sorted(
            (env, threshold)
            for (pid, env), threshold in thresholds.items()
            if pid == project_id and math.isfinite(threshold) and threshold > 0
        )[:MAX_ENVIRONMENTS]
        if not environments:
            continue
        oldest = start - _ISSUE_LIFETIME
        groups = list(
            Group.objects.filter(
                project_id=project.id,
                type=ErrorGroupType.type_id,
                first_seen__gte=oldest.replace(tzinfo=UTC),
                first_seen__lt=end.replace(tzinfo=UTC),
            ).order_by("-first_seen", "id")[:_MAX_NEW_GROUPS]
        )
        if not groups:
            continue
        groups_by_id = {group.id: group for group in groups}
        group_id = Column("group_id")
        for env, threshold in environments:
            conditions = [Condition(_error_env(), Op.EQ, env)]
            candidates = _run_errors(
                organization,
                Query(
                    match=Entity("events"),
                    select=[Function("uniq", [Column(ERROR_USER)], "users"), Function("count", [])],
                    groupby=[group_id],
                    where=[
                        *_error_where(project, oldest, end),
                        *conditions,
                        Condition(group_id, Op.IN, list(groups_by_id)),
                    ],
                    limit=Limit(_MAX_NEW_GROUPS + 1),
                ),
                _REFERRER,
            )
            families: dict[str, list[tuple[Group, float, float]]] = defaultdict(list)
            for row in candidates:
                group = groups_by_id.get(row["group_id"])
                estimate = _number(row.get("users"))
                count = _number(row.get("count()"))
                if group is None or estimate is None or count is None:
                    continue
                # Keep same-title fragments together, but compute their actual
                # joint audience from the events (never sum users to trigger).
                title = (
                    group.title
                    if group.data and ("title" in group.data or "metadata" in group.data)
                    else group.message
                )
                families[title].append((group, estimate, count))
            ranked = sorted(
                families.items(),
                key=lambda family: (-sum(users for _, users, _ in family[1]), family[0]),
            )
            for title, members in ranked[:_MAX_NEW_FAMILIES]:
                if sum(count for _, _, count in members) < min(threshold, _MIN_NEW_USERS):
                    continue
                members.sort(key=lambda member: (member[0].first_seen, member[0].id))
                first_group = members[0][0]
                first_seen = _utc(first_group.first_seen)
                window_end = min(first_seen + _ISSUE_LIFETIME, end)
                if window_end <= start:
                    continue
                ids = [group.id for group, _, _ in members]
                timestamp = Column("timestamp")
                user = Column(ERROR_USER)
                events = _run_errors(
                    organization,
                    Query(
                        match=Entity("events"),
                        select=[timestamp, user],
                        where=[
                            *_error_where(
                                project, first_seen.replace(second=0, microsecond=0), window_end
                            ),
                            *conditions,
                            Condition(group_id, Op.IN, ids),
                        ],
                        orderby=[
                            OrderBy(timestamp, Direction.ASC),
                            OrderBy(Column("event_id"), Direction.ASC),
                        ],
                        limit=Limit(_MAX_ISSUE_EVENTS),
                    ),
                    _REFERRER,
                )
                cutoffs = (
                    (float(_MIN_NEW_USERS), threshold)
                    if threshold > _MIN_NEW_USERS
                    else (threshold,)
                )
                for cutoff, crossed_at, users in _crossings(events, cutoffs):
                    if not start <= crossed_at < window_end:
                        continue
                    confirmed = cutoff == threshold
                    changes.append(
                        ChangeEvent(
                            key=SeriesKey(
                                project_id,
                                env,
                                "new_issue",
                                "count_unique(user)",
                                str(first_group.id),
                            ),
                            change_type=ChangeType.NEW_FAILURE_MODE,
                            start=first_seen.replace(second=0, microsecond=0),
                            actual=users,
                            expected=threshold,
                            confidence=0.9 if confirmed else 0.5,
                            detected_at=crossed_at.replace(second=0, microsecond=0)
                            + timedelta(minutes=1),
                            peak_ratio=users / threshold,
                            evidence=[title[:200], "issues:" + ",".join(map(str, ids))],
                        )
                    )
    return sorted(changes, key=lambda change: (change.detected_at or change.start, change.key))


def _crossings(
    events: Sequence[SnubaRow], cutoffs: tuple[float, ...]
) -> list[tuple[float, datetime, int]]:
    users: set[str] = set()
    found: list[tuple[float, datetime, int]] = []
    for event in events:
        if user := event.get(ERROR_USER):
            users.add(user)
            if len(users) >= cutoffs[len(found)]:
                found.append((cutoffs[len(found)], _utc(event["timestamp"]), len(users)))
                if len(found) == len(cutoffs):
                    break
    # Skip redundant weak evidence if the strong crossing is observable in the
    # same minute, but never hide earlier evidence using later events.
    if len(found) == 2 and found[0][1].replace(second=0, microsecond=0) == found[1][1].replace(
        second=0, microsecond=0
    ):
        return found[1:]
    return found
