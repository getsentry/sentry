"""Look up bounded trace footprints for detector changes."""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from snuba_sdk import Column, Condition, Direction, Entity, Limit, Op, OrderBy, Query

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    Service,
    Signal,
)
from sentry.anomaly_detection.correlation.footprint import (
    FOOTPRINT_DEFERRED,
    CallEdge,
    Footprint,
    FootprintResult,
    Slice,
    SliceStats,
)
from sentry.anomaly_detection.inputs.measurements import (
    ERROR_RELEASE,
    FAILED_QUERY,
    REQUEST_QUERY,
    SPAN_SLICES,
)
from sentry.anomaly_detection.inputs.query import (
    ScopedSpans,
    error_env,
    error_where,
    number,
    project_map,
    run_errors,
    utc,
)
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery
from sentry.snuba.spans_rpc import Spans

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.search.eap.resolver import SearchResolver

_TRACE = "contexts[trace.trace_id]"
_REFERRER = Referrer.ANOMALY_DETECTION_ENRICH.value
_TRACE_SAMPLE = 20
_TRACE_SPAN_LIMIT = 300
_SLICE_LIMIT = 100
_SCOPE = ["project.id", "environment"]
_SLICE_AGGREGATES = ["count_unique(trace)", "p95(span.duration)", "count_sample()"]
_MAX_FOOTPRINTS = 32
_TRACE_ID = re.compile(r"[0-9a-f]{32}", re.IGNORECASE)
_ERROR_SIGNALS = frozenset(
    {Signal.ERRORS, Signal.ERROR_RATE, Signal.ERRORS_BY_RELEASE, Signal.NEW_ISSUE}
)
_SPAN_BY_NAME = {signal.name: signal for signal in SPAN_SLICES}


def _traces(rows: Sequence[SnubaRow], field: str) -> list[str]:
    return sorted(
        {
            value.lower()
            for row in rows
            if isinstance(value := row.get(field), str) and _TRACE_ID.fullmatch(value)
        }
    )


def _table_query(
    name: str,
    resolver: SearchResolver,
    query: str,
    columns: list[str],
    orderby: list[str],
    limit: int,
) -> TableQuery:
    return TableQuery(
        name=name,
        query_string=query,
        selected_columns=columns,
        orderby=orderby,
        offset=0,
        limit=limit,
        referrer=_REFERRER,
        sampling_mode="HIGHEST_ACCURACY",
        resolver=resolver,
    )


class TraceLookup:
    """Correlator footprint source. Scope the sample to the change before expanding its traces."""

    def __init__(self, organization: Organization, projects: Sequence[Project]) -> None:
        self.organization = organization
        self.projects = project_map(organization, projects)
        self.span_projects = [
            project for project in self.projects.values() if Spans.filter_project(project)
        ]
        self.cache: dict[
            tuple[SeriesKey, ChangeType, datetime, datetime, tuple[int, ...]], Footprint | None
        ] = {}

    def footprint(self, change: ChangeEvent, observation_end: datetime) -> FootprintResult:
        """Look up affected traces using only data before the exclusive observation end."""
        if change.change_type in {ChangeType.DROP, ChangeType.SILENCE} or not self.span_projects:
            return None
        project = self.projects.get(change.key.project_id)
        if project is None:
            return None
        detected = utc(change.detected_at or change.start)
        onset = utc(change.start)
        if change.key.signal == Signal.NEW_ISSUE:
            # An issue can cross the user threshold long after its onset.
            if not change.issue_ids:
                return None
            start = max(onset - timedelta(minutes=1), detected - timedelta(minutes=15))
            end = detected
        else:
            start = onset - timedelta(minutes=1)
            end = min(
                max(detected, onset + timedelta(minutes=3)), onset + timedelta(minutes=15)
            ) + timedelta(minutes=1)
        end = min(end, utc(observation_end))
        if start >= end:
            return None
        cache_key = (change.key, change.change_type, start, end, change.issue_ids)
        if cache_key in self.cache:
            return self.cache[cache_key]
        if len(self.cache) >= _MAX_FOOTPRINTS:
            return FOOTPRINT_DEFERRED
        self.cache[cache_key] = self._lookup(change, project, start, end)
        return self.cache[cache_key]

    def _resolver(
        self,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
        filters: tuple[tuple[str, tuple[str, ...]], ...],
    ) -> SearchResolver:
        return Spans.get_resolver(
            SnubaParams(organization=self.organization, projects=projects, start=start, end=end),
            ScopedSpans(filters=filters, disable_aggregate_extrapolation=True),
        )

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
        resolver = self._resolver([project], start, end, (("environment", (env,)), *filters))
        sample = _table_query(
            "sample",
            resolver,
            query,
            ["trace", "span.duration"],
            ["-span.duration", "trace"],
            _TRACE_SAMPLE,
        )
        return _traces(Spans.run_bulk_table_queries([sample])["sample"]["data"], "trace")

    def _lookup(
        self, change: ChangeEvent, project: Project, start: datetime, end: datetime
    ) -> Footprint | None:
        key = change.key
        name = key.signal
        if name in _ERROR_SIGNALS:
            conditions = [
                *error_where(project, start, end),
                Condition(error_env(), Op.EQ, key.env),
                # Untraced errors would otherwise crowd traced ones out of the sample.
                Condition(Column(_TRACE), Op.IS_NOT_NULL),
            ]
            if name == Signal.NEW_ISSUE:
                conditions.append(Condition(Column("group_id"), Op.IN, list(change.issue_ids)))
            elif name == Signal.ERRORS_BY_RELEASE:
                conditions.append(Condition(Column(ERROR_RELEASE), Op.EQ, key.dim_value))
            traces = _traces(
                run_errors(
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
                result = self._build(traces, start, end)
                if result.slices or result.edges:
                    return result
            return None

        filters: tuple[tuple[str, tuple[str, ...]], ...]
        if (signal := _SPAN_BY_NAME.get(name)) is not None:
            query = signal.query
            filters = ((signal.dimension, (key.dim_value,)),)
            if key.metric == Metric.FAILURE_RATE:
                query += " !span.status:[ok,cancelled,unknown]"
        elif name == Signal.REQUESTS:
            query, filters = REQUEST_QUERY, ()
        elif name in (Signal.FAILED_REQUESTS, Signal.FAILED_RATE):
            query, filters = FAILED_QUERY, ()
        else:
            return None
        traces = self._sample_spans(project, key.env, start, end, query, filters)
        return self._build(traces, start, end) if traces else None

    def _build(self, traces: list[str], start: datetime, end: datetime) -> Footprint:
        resolver = self._resolver(self.span_projects, start, end, (("trace", tuple(traces)),))
        slices: list[tuple[Signal | None, str, str]] = [
            (None, REQUEST_QUERY, ""),
            *((s.name, s.query, s.dimension) for s in SPAN_SLICES),
        ]
        queries = []
        for index, (_, query, dimension) in enumerate(slices):
            fields = [*_SCOPE, dimension] if dimension else _SCOPE
            queries.append(
                _table_query(
                    f"slice-{index}",
                    resolver,
                    query,
                    [*fields, *_SLICE_AGGREGATES],
                    ["-count_unique(trace)", *fields],
                    _SLICE_LIMIT,
                )
            )
        # A span ID is only unique within its trace. Join HTTP client spans to
        # transactions by (trace, parent) rather than domain/transaction names.
        queries.append(
            _table_query(
                "calls",
                resolver,
                "span.op:http.client",
                [*_SCOPE, "trace", "span_id", "span.domain"],
                ["trace", "span_id"],
                _TRACE_SPAN_LIMIT,
            )
        )
        queries.append(
            _table_query(
                "transactions",
                resolver,
                REQUEST_QUERY,
                [*_SCOPE, "trace", "span_id", "parent_span"],
                ["trace", "span_id"],
                _TRACE_SPAN_LIMIT,
            )
        )
        # The queries only share the sampled traces, so dispatch them together.
        results = Spans.run_bulk_table_queries(queries)

        footprint = Footprint()
        for index, (signal, _, dimension) in enumerate(slices):
            for row in results[f"slice-{index}"]["data"]:
                service = _service(row)
                dim = row.get(dimension) or "" if dimension else ""
                count = number(row.get("count_sample()"))
                touched = number(row.get("count_unique(trace)"))
                if (
                    service.project_id in self.projects
                    and (not dimension or dim)
                    and count
                    and touched
                ):
                    footprint.slices[Slice(service, signal, dim)] = SliceStats(
                        min(touched / len(traces), 1.0),
                        number(row.get("p95(span.duration)")),
                    )
        callers: dict[tuple[str, str | None], tuple[Service, str]] = {}
        for row in results["calls"]["data"]:
            caller = _service(row)
            if row.get("span_id") and row.get("span.domain") and caller.project_id in self.projects:
                callers[row["trace"], row["span_id"]] = caller, row["span.domain"]
        joined = set()
        for row in results["transactions"]["data"]:
            callee = _service(row)
            if callee.project_id not in self.projects:
                continue
            child = (row["trace"], row["span_id"])
            if child in joined:
                continue
            if (call := callers.get((row["trace"], row.get("parent_span")))) is not None:
                caller, domain = call
                footprint.edges[CallEdge(caller, domain, callee)] += 1
                joined.add(child)
        return footprint


def _service(row: SnubaRow) -> Service:
    return Service(int(row["project.id"]), row.get("environment") or "")
