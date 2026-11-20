from datetime import UTC, datetime, timedelta, timezone
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
    Service,
    Signal,
)
from sentry.anomaly_detection.inputs import measurements, new_failures
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
from sentry.anomaly_detection.state import client
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import LimitBy as SpanLimitBy
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import TestCase
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaError

START = datetime(2025, 10, 1, tzinfo=UTC)
MINUTE = timedelta(minutes=1)
RAW_SNQL = "sentry.anomaly_detection.inputs.query.raw_snql_query"


class TestCollection(TestCase):
    def test_snql_errors_keep_explicit_scopes_and_missing_values(self) -> None:
        start = START.astimezone(timezone(timedelta(hours=-7)))
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
            (ts, project, env, signal, metric, dimension): value
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
            assert request.query.where[1].rhs == START - timedelta(days=int(index == 1))
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
        moment = Timestamp(seconds=int(START.timestamp()))
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
        assert SeriesRow(START, project, env, requests, Metric.COUNT, "", 1000.0) in rows
        assert SeriesRow(START, project, env, requests, Metric.COUNT_SAMPLE, "", 100.0) in rows
        for metric in (Metric.COUNT, Metric.COUNT_SAMPLE):
            assert SeriesRow(START, project, env, failed, metric, "", 0.0) in rows
            assert SeriesRow(START + MINUTE, project, env, requests, metric, "", 0.0) in rows
            assert SeriesRow(START + 2 * MINUTE, project, env, requests, metric, "", 0.0) in rows
        assert all(ts == START for ts, _, _, signal, *_ in rows if signal == Signal.FAILED_REQUESTS)
        assert (
            SeriesRow(
                START,
                project,
                env,
                Signal.ENDPOINTS,
                Metric.FAILURE_RATE,
                dimensions["transaction"],
                0.0,
            )
            in rows
        )
        assert (
            SeriesRow(START, project, env, Signal.OUTBOUND_DB, Metric.P95_DURATION, "primary", 30.0)
            in rows
        )
        assert (
            SeriesRow(
                START + MINUTE,
                project,
                env,
                Signal.OUTBOUND_HTTP,
                Metric.P95_DURATION,
                "example.com",
                None,
            )
            in rows
        )
        # A covered slice with no traffic in a bucket counts 0, without latency or failures.
        empty = [
            (metric, value)
            for ts, _, _, _, metric, dim, value in rows
            if ts in (START + MINUTE, START + 2 * MINUTE) and dim
        ]
        assert {metric for metric, _ in empty} == {
            Metric.COUNT,
            Metric.COUNT_SAMPLE,
            Metric.P95_DURATION,
            Metric.FAILURE_RATE,
        }
        assert all(value == (0.0 if metric.is_count else None) for metric, value in empty)

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
            SeriesRow(START, project, "test", Signal.ERRORS, Metric.COUNT, "", 0.0),
            SeriesRow(START, project, "test", Signal.ERRORS, Metric.COUNT_UNIQUE_USER, "", 0.0),
        ]
        assert raw.call_args.args[0].query.granularity.granularity == 3600

    def test_environment_inventory_is_cached_and_merged_with_current_window(self) -> None:
        lookback = START - timedelta(days=1)

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
            (lookback, START + MINUTE),
            (START + MINUTE, START + 2 * MINUTE),
        ]
        # The errors inventory scans the lookback once.
        error_starts = [call.args[0].query.where[1].rhs for call in raw.call_args_list]
        assert [rhs for rhs in error_starts if rhs < START] == [lookback]
        # Inventories live in the organization's Redis slot and expire on their own.
        for dataset in ("errors", "spans"):
            key = (
                f"anomaly-detection:{{{self.organization.id}}}:environments:v1:"
                f"{self.project.id}:{dataset}:60"
            )
            assert 0 < client().ttl(key) <= 600


def test_failure_thresholds_use_only_observed_hourly_error_users() -> None:
    rows = [
        SeriesRow(START, 10, "prod", Signal.ERRORS, Metric.COUNT_UNIQUE_USER, "", 300.0),
        SeriesRow(
            START + timedelta(hours=1),
            10,
            "prod",
            Signal.ERRORS,
            Metric.COUNT_UNIQUE_USER,
            "",
            None,
        ),
        SeriesRow(START, 10, "stage", Signal.ERRORS, Metric.COUNT_UNIQUE_USER, "", 5.0),
        SeriesRow(
            START, 10, "stage", Signal.ERRORS_BY_RELEASE, Metric.COUNT_UNIQUE_USER, "v1", 2000.0
        ),
        SeriesRow(START, 10, "unobserved", Signal.ERRORS, Metric.COUNT_UNIQUE_USER, "", None),
    ]
    thresholds = new_failures.new_failure_thresholds(rows)
    observation_end = START + timedelta(hours=2)
    assert thresholds.at(Service(10, "prod"), observation_end) == 15.0
    assert thresholds.at(Service(10, "stage"), observation_end) == 10.0
    assert thresholds.at(Service(10, "unobserved"), observation_end) == 10.0
