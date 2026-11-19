from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import (
    DataPoint,
    TimeSeries,
    TimeSeriesRequest,
    TimeSeriesResponse,
)
from snuba_sdk import Column, Condition, Function, Op

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
)
from sentry.anomaly_detection.correlation.footprint import (
    FOOTPRINT_DEFERRED,
    CallEdge,
    Footprint,
    Slice,
)
from sentry.anomaly_detection.inputs import measurements, new_failures, trace_lookup
from sentry.anomaly_detection.inputs.measurements import (
    ERROR_RELEASE,
    ERROR_USER,
    MAX_ENVIRONMENTS,
    MAX_SLICES,
    IncompleteCollection,
    collect,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import LimitBy as SpanLimitBy
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import TestCase
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaError

START = datetime(2025, 10, 1)
MINUTE = timedelta(minutes=1)


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
            mock.patch.object(measurements, "raw_snql_query", side_effect=replies) as raw,
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
            mock.patch.object(measurements, "raw_snql_query", return_value={"data": []}),
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
            assert isinstance(config, measurements.ScopedSpans)
            if len(kwargs["selected_columns"]) == 2:
                assert kwargs["limit"] == MAX_ENVIRONMENTS
                assert kwargs["limit_by"] is None
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
            mock.patch.object(
                measurements,
                "raw_snql_query",
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
            mock.patch.object(measurements, "raw_snql_query", return_value={"data": []}),
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
        with mock.patch.object(measurements, "raw_snql_query") as raw:
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
            mock.patch.object(
                measurements,
                "raw_snql_query",
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


class TestEnrichment(TestCase):
    def test_trace_footprint_joins_parent_only_in_same_trace(self) -> None:
        project = self.project.id
        key = SeriesKey(project, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "GET /x")
        change = ChangeEvent(key, ChangeType.SLOWDOWN, START, 100, 10, 0.9)
        trace1, trace2 = "a" * 32, "b" * 32
        scope = {"project.id": self.project.id, "environment": "prod"}
        observation_end = START + MINUTE
        with (
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(
                Spans,
                "run_table_query",
                side_effect=[
                    {"data": [{"trace": trace1}, {"trace": trace2}]},
                    {
                        "data": [
                            {
                                **scope,
                                "count_unique(trace)": 1,
                                "count_sample()": 3,
                                "p95(span.duration)": 100,
                            }
                        ]
                    },
                    {"data": []},
                    {"data": []},
                    {"data": []},
                    {
                        "data": [
                            {
                                **scope,
                                "trace": trace1,
                                "span_id": "parent",
                                "span.domain": "backend",
                            }
                        ]
                    },
                    {
                        "data": [
                            {**scope, "trace": trace1, "span_id": "child", "parent_span": "parent"},
                            {**scope, "trace": trace2, "span_id": "child", "parent_span": "parent"},
                        ]
                    },
                ],
            ) as table,
        ):
            lookup = trace_lookup.TraceLookup(self.organization, [self.project])
            footprint = lookup.footprint(change, observation_end)
            assert isinstance(footprint, Footprint)
            assert lookup.footprint(change, observation_end) is footprint
        assert footprint.window == (START - MINUTE, observation_end)
        expected_end = observation_end.replace(tzinfo=timezone.utc)
        assert all(call.kwargs["params"].end == expected_end for call in table.call_args_list)
        service = Service(project, "prod")
        assert footprint.slices[Slice(service, None, "")].trace_share == 0.5
        assert footprint.edges == {CallEdge(service, "backend", service): 1}
        assert table.call_count == 7
        assert table.call_args_list[0].kwargs["config"].filters == (
            ("environment", ("prod",)),
            ("transaction", ("GET /x",)),
        )

    def test_late_new_issue_samples_near_detection_with_typed_issue_ids(self) -> None:
        detected = START + 35 * MINUTE
        trace = "a" * 32
        change = ChangeEvent(
            SeriesKey(self.project.id, "prod", Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "11"),
            ChangeType.NEW_FAILURE_MODE,
            START,
            10,
            10,
            0.9,
            evidence=["issues:999"],
            detected_at=detected,
            issue_ids=(11, 12),
        )
        with (
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(
                trace_lookup, "_run_errors", return_value=[{"contexts[trace.trace_id]": trace}]
            ) as errors,
            mock.patch.object(Spans, "run_table_query", return_value={"data": []}) as spans,
        ):
            lookup = trace_lookup.TraceLookup(self.organization, [self.project])
            assert lookup.footprint(change, detected + MINUTE) is None

        errors.assert_called_once()
        snql = errors.call_args.args[1]
        first, last, *_ = snql.where[1:]
        assert first.rhs == (detected - 15 * MINUTE).replace(tzinfo=timezone.utc)
        assert last.rhs == detected.replace(tzinfo=timezone.utc)
        assert last.op == Op.LT
        assert snql.where[-1].lhs == Column("group_id")
        assert snql.where[-1].rhs == [11, 12]
        assert spans.call_count == 6
        expected_end = detected.replace(tzinfo=timezone.utc)
        assert all(call.kwargs["params"].end == expected_end for call in spans.call_args_list)
        assert all(
            call.kwargs["config"].filters == (("trace", (trace,)),) for call in spans.call_args_list
        )

    def test_untraced_error_does_not_sample_matching_transaction_names(self) -> None:
        change = ChangeEvent(
            SeriesKey(self.project.id, "prod", Signal.ERRORS, Metric.COUNT),
            ChangeType.SPIKE,
            START,
            10,
            1,
            0.9,
        )
        with (
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(trace_lookup, "_run_errors", return_value=[{}]) as errors,
            mock.patch.object(Spans, "run_table_query") as spans,
        ):
            lookup = trace_lookup.TraceLookup(self.organization, [self.project])
            assert lookup.footprint(change, START + MINUTE) is None
        errors.assert_called_once()
        _, snql, referrer = errors.call_args.args
        assert Condition(Column("contexts[trace.trace_id]"), Op.IS_NOT_NULL) in snql.where
        assert referrer == Referrer.ANOMALY_DETECTION_ENRICH
        spans.assert_not_called()

    def test_exhausted_footprint_budget_does_not_cache_misses(self) -> None:
        change = ChangeEvent(
            SeriesKey(self.project.id, "prod", Signal.REQUESTS, Metric.COUNT),
            ChangeType.SPIKE,
            START,
            10,
            1,
            0.9,
        )
        with (
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(Spans, "run_table_query", return_value={"data": []}) as spans,
            mock.patch.object(trace_lookup, "_MAX_FOOTPRINTS", 1),
        ):
            lookup = trace_lookup.TraceLookup(self.organization, [self.project])
            assert lookup.footprint(change, START + MINUTE) is None
            assert lookup.footprint(change, START + 2 * MINUTE) is FOOTPRINT_DEFERRED
            assert lookup.footprint(change, START + MINUTE) is None
        spans.assert_called_once()


def test_failure_thresholds_use_only_observed_hourly_error_users() -> None:
    rows = [
        SeriesRow(START, Signal.ERRORS, Metric.COUNT_UNIQUE_USER, 10, "prod", "", 300.0),
        SeriesRow(
            START + timedelta(hours=1),
            Signal.ERRORS,
            Metric.COUNT_UNIQUE_USER,
            10,
            "prod",
            "",
            None,
        ),
        SeriesRow(START, Signal.ERRORS, Metric.COUNT_UNIQUE_USER, 10, "stage", "", 5.0),
        SeriesRow(
            START, Signal.ERRORS_BY_RELEASE, Metric.COUNT_UNIQUE_USER, 10, "stage", "v1", 2000.0
        ),
        SeriesRow(START, Signal.ERRORS, Metric.COUNT_UNIQUE_USER, 10, "unobserved", "", None),
    ]
    thresholds = new_failures.new_failure_thresholds(rows)
    observation_end = START + timedelta(hours=2)
    assert thresholds.at(Service(10, "prod"), observation_end) == 15.0
    assert thresholds.at(Service(10, "stage"), observation_end) == 10.0
    assert thresholds.at(Service(10, "unobserved"), observation_end) == 10.0
