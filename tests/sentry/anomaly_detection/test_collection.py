from datetime import datetime, timedelta, timezone
from typing import Any
from unittest import mock

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import (
    DataPoint,
    TimeSeries,
    TimeSeriesRequest,
    TimeSeriesResponse,
)
from snuba_sdk import Column, Function, Op

from sentry.anomaly_detection.contracts import (
    Metric,
    SeriesRow,
    Signal,
)
from sentry.anomaly_detection.inputs import (
    hourly_snapshot,
    measurements,
)
from sentry.anomaly_detection.inputs.measurements import (
    ERROR_RELEASE,
    ERROR_USER,
    MAX_ENVIRONMENTS,
    MAX_SLICES,
    REQUEST_QUERY,
    IncompleteCollection,
    collect,
)
from sentry.anomaly_detection.inputs.query import ScopedSpans
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import LimitBy as SpanLimitBy
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import TestCase
from sentry.utils import snuba_rpc
from sentry.utils.cache import cache
from sentry.utils.snuba import SnubaError

START = datetime(2025, 10, 1)
MINUTE = timedelta(minutes=1)
RAW_SNQL = "sentry.anomaly_detection.inputs.query.raw_snql_query"


class TestCollection(TestCase):
    def test_snql_errors_keep_explicit_scopes_and_missing_values(self) -> None:
        start = START.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=-7)))
        replies = [
            {"data": [{"env": "prod,blue"}, {"env": ""}]},
            {"data": []},  # No previously active environments outside current discovery.
            {"data": [{"env": "prod,blue", ERROR_RELEASE: "service,2"}]},
            {
                "data": [
                    {"time": "2025-10-01T00:00:00Z", "env": "", "count()": 8, "users": 0},
                    {"time": "2025-10-01T00:01:00Z", "env": "prod,blue", "count()": 4, "users": 2},
                ]
            },
            {
                "data": [
                    {
                        "time": "2025-10-01T00:01:00+00:00",
                        "env": "prod,blue",
                        ERROR_RELEASE: "service,2",
                        "count()": 4,
                        "users": 2,
                    }
                ]
            },
        ]
        with (
            mock.patch(RAW_SNQL, side_effect=replies) as raw,
            mock.patch.object(Spans, "filter_project", return_value=False),
        ):
            rows = collect(self.organization, [self.project], start, start + 2 * MINUTE, "1m")

        project = self.project.id
        expected = [
            (START, Signal.ERRORS, "", "", 8.0, 0.0),
            (START, Signal.ERRORS, "prod,blue", "", 0.0, 0.0),
            (START + MINUTE, Signal.ERRORS, "", "", 0.0, 0.0),
            (START + MINUTE, Signal.ERRORS, "prod,blue", "", 4.0, 2.0),
            (START, Signal.ERRORS_BY_RELEASE, "prod,blue", "service,2", 0.0, 0.0),
            (START + MINUTE, Signal.ERRORS_BY_RELEASE, "prod,blue", "service,2", 4.0, 2.0),
        ]
        assert {row[:-1]: row[-1] for row in rows} == {
            (ts, signal, metric, project, env, dimension): value
            for ts, signal, env, dimension, count, users in expected
            for metric, value in [(Metric.COUNT, count), (Metric.COUNT_UNIQUE_USER, users)]
        }
        assert raw.call_count == 5
        for index, call in enumerate(raw.call_args_list):
            assert call.kwargs["referrer"] == Referrer.ANOMALY_DETECTION_COLLECT
            (request,) = call.args
            request.serialize()
            assert request.dataset == Dataset.Events.value
            assert request.tenant_ids == {"organization_id": self.organization.id}
            assert request.query.where[0].rhs == self.project.id
            assert request.query.where[1].rhs == START.replace(tzinfo=timezone.utc) - timedelta(
                days=int(index == 1)
            )
            assert request.query.where[2].op == Op.LT
        for call in raw.call_args_list[3:]:
            query = call.args[0].query
            assert query.granularity.granularity == 60
            assert query.select == [
                Function("count", []),
                Function("uniq", [Column(ERROR_USER)], "users"),
            ]
            assert len(query.where) == 4  # Project, time range, and environment/release scope.

    def test_spans_catalog_and_sparse_protobuf_response(self) -> None:
        env = 'prod,"blue"'
        dimensions = {
            "transaction": "GET /foo,*",
            "db.name": "primary",
            "span.domain": "example.com",
        }
        moment = Timestamp(seconds=int(START.replace(tzinfo=timezone.utc).timestamp()))
        next_minute = Timestamp(seconds=moment.seconds + 60)
        grouping_queries: set[str] = set()

        def discover(
            *, query_string: str, selected_columns: list[str], **kwargs: object
        ) -> dict[str, list[dict[str, str | int]]]:
            grouping_queries.add(query_string)
            if selected_columns == ["environment", "count()"]:
                return {"data": [{"environment": env, "count()": 1000}]}
            dimension = selected_columns[1]
            return {"data": [{"environment": env, dimension: dimensions[dimension]}]}

        def timeseries(requests: list[TimeSeriesRequest]) -> list[TimeSeriesResponse]:
            (request,) = requests
            group = {request.group_by[0].name: env}
            if len(request.group_by) == 2:
                labels = [expr.label for expr in request.expressions]
                # This fixture gives all three dimensions unique values; use the
                # structured filter rather than concatenating group labels.
                for dimension, value in dimensions.items():
                    if value in str(request.filter):
                        group[request.group_by[1].name] = dimensions[dimension]
                        break
                assert len(group) == 2
            else:
                labels = [expr.label for expr in request.expressions]
            if "http.response.status_code" in str(request.filter):
                return [TimeSeriesResponse()]
            values = {
                "count()": 1000,
                "count_sample()": 100,
                "p95(span.duration)": 30.0,
                "failure_rate()": 0.0,
            }
            return [
                TimeSeriesResponse(
                    result_timeseries=[
                        TimeSeries(
                            label=label,
                            group_by_attributes=group,
                            buckets=[moment, next_minute],
                            data_points=[
                                DataPoint(data=values[label], data_present=True),
                                DataPoint(data=0, data_present=False),
                            ],
                        )
                        for label in labels
                    ]
                )
            ]

        with (
            mock.patch(RAW_SNQL, return_value={"data": []}),
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(Spans, "run_table_query", side_effect=discover) as table,
            mock.patch.object(snuba_rpc, "timeseries_rpc", side_effect=timeseries) as rpc,
        ):
            rows = collect(self.organization, [self.project], START, START + 3 * MINUTE, "1m")
        assert grouping_queries == {
            "is_transaction:true",
            "span.category:db",
            "span.op:http.client",
        }
        assert table.call_count == 6
        # Environment discovery for outbound slices only counts spans that name the slice.
        named = {measurements.REQUEST_QUERY: ""} | {
            signal.query: signal.dimension
            for signal in measurements.SPAN_SLICES
            if signal.query != measurements.REQUEST_QUERY
        }
        for call in table.call_args_list:
            kwargs = call.kwargs
            assert kwargs["referrer"] == Referrer.ANOMALY_DETECTION_COLLECT
            assert kwargs.get("sampling_mode") is None
            config = kwargs["config"]
            assert isinstance(config, ScopedSpans)
            if len(kwargs["selected_columns"]) == 2:
                assert kwargs["limit"] == MAX_ENVIRONMENTS
                assert kwargs.get("limit_by") is None
                assert config.filters == ()
                assert config.named_dimension == named[kwargs["query_string"]]
            else:
                dimension = kwargs["selected_columns"][1]
                assert kwargs["limit"] == MAX_SLICES + 1
                assert kwargs["limit_by"] == SpanLimitBy(columns=["environment"], limit=MAX_SLICES)
                assert config.filters == (("environment", (env,)),)
                assert config.named_dimension == dimension
        for call in rpc.call_args_list:
            (request,) = call.args[0]
            assert request.meta.organization_id == self.organization.id
            assert list(request.meta.project_ids) == [self.project.id]
            assert request.granularity_secs == 60
        assert len(rpc.call_args_list) == 5
        project = self.project.id
        requests, failed = Signal.REQUESTS, Signal.FAILED_REQUESTS
        assert SeriesRow(START, requests, Metric.COUNT, project, env, "", 1000.0) in rows
        assert SeriesRow(START, requests, Metric.COUNT_SAMPLE, project, env, "", 100.0) in rows
        for metric in (Metric.COUNT, Metric.COUNT_SAMPLE):
            assert SeriesRow(START, failed, metric, project, env, "", 0.0) in rows
            assert SeriesRow(START + MINUTE, requests, metric, project, env, "", 0.0) in rows
            assert SeriesRow(START + 2 * MINUTE, requests, metric, project, env, "", 0.0) in rows
        assert all(ts == START for ts, signal, *_ in rows if signal == Signal.FAILED_REQUESTS)
        assert (
            SeriesRow(
                START,
                Signal.ENDPOINTS,
                Metric.FAILURE_RATE,
                project,
                env,
                dimensions["transaction"],
                0.0,
            )
            in rows
        )
        assert (
            SeriesRow(START, Signal.OUTBOUND_DB, Metric.P95_DURATION, project, env, "primary", 30.0)
            in rows
        )
        assert (
            SeriesRow(
                START + MINUTE,
                Signal.OUTBOUND_HTTP,
                Metric.P95_DURATION,
                project,
                env,
                "example.com",
                None,
            )
            in rows
        )
        assert all(
            value is None for ts, _, _, _, _, dim, value in rows if ts == START + MINUTE and dim
        )

    def test_propagates_failure_and_rejects_overflowing_slice_partitions(self) -> None:
        with (
            mock.patch(
                RAW_SNQL,
                side_effect=[
                    {"data": [{"env": "prod"}]},
                    {"data": []},
                    {"data": []},
                    SnubaError("query failure"),
                ],
            ),
            mock.patch.object(Spans, "filter_project", return_value=False),
        ):
            with pytest.raises(SnubaError, match="query failure"):
                collect(self.organization, [self.project], START, START + MINUTE, "1m")

        # LIMIT BY caps null and empty environments as separate partitions, but
        # both are the "" scope, so together they can exceed its slice bound.
        slices = [
            *({"environment": None, "transaction": f"/null-{i}"} for i in range(MAX_SLICES)),
            {"environment": "", "transaction": "/empty"},
        ]
        with (
            mock.patch(RAW_SNQL, return_value={"data": []}),
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(
                Spans,
                "run_table_query",
                side_effect=[{"data": [{"environment": None}]}, {"data": slices}],
            ),
            mock.patch.object(snuba_rpc, "timeseries_rpc", return_value=[TimeSeriesResponse()]),
        ):
            with pytest.raises(IncompleteCollection, match="partition limit"):
                collect(self.organization, [self.project], START, START + MINUTE, "1m")

    def test_hourly_request_and_reject_foreign_project(self) -> None:
        foreign = self.create_project(organization=self.create_organization())
        with mock.patch(RAW_SNQL) as raw:
            with pytest.raises(ValueError, match="belong to the organization"):
                collect(
                    self.organization,
                    [self.project, foreign],
                    START,
                    START + timedelta(hours=1),
                    "1h",
                )
            raw.assert_not_called()
        with (
            mock.patch(
                RAW_SNQL,
                side_effect=[
                    {"data": [{"env": "test"}]},
                    {"data": []},
                    {"data": []},
                    {"data": []},
                ],
            ) as raw,
            mock.patch.object(Spans, "filter_project", return_value=False),
        ):
            rows = collect(
                self.organization, [self.project], START, START + timedelta(hours=1), "1h"
            )
        project = self.project.id
        assert rows == [
            SeriesRow(START, Signal.ERRORS, Metric.COUNT, project, "test", "", 0.0),
            SeriesRow(START, Signal.ERRORS, Metric.COUNT_UNIQUE_USER, project, "test", "", 0.0),
        ]
        assert raw.call_args.args[0].query.granularity.granularity == 3600

    def test_environment_inventory_is_cached_and_merged_with_current_window(self) -> None:
        lookback = (START - timedelta(days=1)).replace(tzinfo=timezone.utc)

        def discover(
            *, params: Any, query_string: str, selected_columns: list[str], **kwargs: object
        ) -> dict[str, list[dict[str, Any]]]:
            if query_string != REQUEST_QUERY or selected_columns != ["environment", "count()"]:
                return {"data": []}
            if params.start == lookback:
                return {
                    "data": [
                        {"environment": "prod", "count()": 50},
                        {"environment": "stage", "count()": 5},
                    ]
                }
            return {"data": [{"environment": "preview", "count()": 10}]}

        with (
            mock.patch.object(measurements, "MAX_ENVIRONMENTS", 2),
            mock.patch(RAW_SNQL, return_value={"data": []}) as raw,
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(Spans, "run_table_query", side_effect=discover) as table,
            mock.patch.object(snuba_rpc, "timeseries_rpc", return_value=[TimeSeriesResponse()]),
        ):
            first = collect(self.organization, [self.project], START, START + MINUTE, "1m")
            second = collect(
                self.organization, [self.project], START + MINUTE, START + 2 * MINUTE, "1m"
            )

        # Request scopes also keep their errors measurable, so errors show the ranking.
        assert {row.env for row in first if row.signal == Signal.ERRORS} == {"prod", "stage"}
        # The cached inventory is merged with the current window, busiest first.
        assert {row.env for row in second if row.signal == Signal.ERRORS} == {"prod", "preview"}
        request_windows = [
            (call.kwargs["params"].start, call.kwargs["params"].end)
            for call in table.call_args_list
            if call.kwargs["query_string"] == REQUEST_QUERY
            and len(call.kwargs["selected_columns"]) == 2
        ]
        assert request_windows == [
            (lookback, (START + MINUTE).replace(tzinfo=timezone.utc)),
            (
                (START + MINUTE).replace(tzinfo=timezone.utc),
                (START + 2 * MINUTE).replace(tzinfo=timezone.utc),
            ),
        ]
        # The errors inventory scans the lookback once.
        error_starts = [call.args[0].query.where[1].rhs for call in raw.call_args_list]
        assert [rhs for rhs in error_starts if rhs < START.replace(tzinfo=timezone.utc)] == [
            lookback
        ]


class TestHourlySnapshot(TestCase):
    ROWS = [
        SeriesRow(START, Signal.ERRORS, Metric.COUNT, 1, "", "", 4.0),
        SeriesRow(START, Signal.ENDPOINTS, Metric.P95_DURATION, 1, "prod", "GET /x", None),
    ]
    HOUR = START + timedelta(hours=2)

    def test_reuses_snapshot_within_hour(self) -> None:
        with mock.patch.object(hourly_snapshot, "collect", return_value=self.ROWS) as collected:
            first = hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR)
            second = hourly_snapshot.hourly_rows(
                self.organization, [self.project], self.HOUR + 30 * MINUTE
            )
        collected.assert_called_once_with(
            self.organization, [self.project], self.HOUR - timedelta(days=16), self.HOUR, "1h"
        )
        assert first == second == self.ROWS
        (errors, latency) = second
        assert errors.ts.tzinfo is None
        assert type(errors.signal) is Signal and type(errors.metric) is Metric
        assert latency.value is None

    def test_large_snapshot_is_chunked_and_reused(self) -> None:
        rows = [
            SeriesRow(START, Signal.ENDPOINTS, Metric.COUNT, 1, "prod", f"/{index}", float(index))
            for index in range(500)
        ]
        with (
            mock.patch.object(hourly_snapshot, "_CHUNK_BYTES", 256),
            mock.patch.object(hourly_snapshot, "cache", wraps=cache) as spy,
            mock.patch.object(hourly_snapshot, "collect", return_value=rows) as collected,
        ):
            assert hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR) == rows
            assert hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR) == rows
        collected.assert_called_once()
        (chunks, _), _ = spy.set_many.call_args
        assert len(chunks) > 1
        assert all(len(chunk) <= 256 for chunk in chunks.values())

    def test_missing_or_corrupt_chunk_recollects_and_repairs(self) -> None:
        with (
            mock.patch.object(hourly_snapshot, "_CHUNK_BYTES", 16),
            mock.patch.object(hourly_snapshot, "cache", wraps=cache) as spy,
            mock.patch.object(hourly_snapshot, "collect", return_value=self.ROWS) as collected,
            mock.patch.object(hourly_snapshot, "metrics") as metrics,
        ):
            hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR)
            (chunks, _), _ = spy.set_many.call_args
            first_chunk, last_chunk = list(chunks)[0], list(chunks)[-1]

            cache.delete(first_chunk)
            assert hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR) == (
                self.ROWS
            )
            # The recollection rewrote the snapshot.
            assert hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR) == (
                self.ROWS
            )
            assert collected.call_count == 2

            cache.set(last_chunk, b"corrupt", 3600)
            assert hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR) == (
                self.ROWS
            )
            assert hourly_snapshot.hourly_rows(self.organization, [self.project], self.HOUR) == (
                self.ROWS
            )
            assert collected.call_count == 3
        assert metrics.incr.call_args_list == [
            mock.call("anomaly_detection.hourly_snapshot_corrupt", tags={"reason": "missing"}),
            mock.call("anomaly_detection.hourly_snapshot_corrupt", tags={"reason": "digest"}),
        ]

    def test_project_scopes_and_hours_do_not_collide(self) -> None:
        other = self.create_project(organization=self.organization)
        scopes = [
            ([self.project], self.HOUR),
            ([self.project, other], self.HOUR),
            ([self.project], self.HOUR + timedelta(hours=1)),
        ]
        snapshots = [
            [SeriesRow(START, Signal.ERRORS, Metric.COUNT, 1, "", "", float(index))]
            for index in range(len(scopes))
        ]
        with mock.patch.object(hourly_snapshot, "collect", side_effect=snapshots) as collected:
            for _ in range(2):
                assert [
                    hourly_snapshot.hourly_rows(self.organization, projects, end)
                    for projects, end in scopes
                ] == snapshots
        assert collected.call_count == len(scopes)
