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
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from snuba_sdk import Column, Op

from sentry.anomaly_detection import collection, enrichment
from sentry.anomaly_detection.collection import (
    ERROR_RELEASE,
    ERROR_USER,
    IncompleteCollection,
    Row,
    collect,
)
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey
from sentry.grouping.grouptype import ErrorGroupType
from sentry.snuba.dataset import Dataset
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
            {"data": [{"env": "prod,blue", ERROR_RELEASE: "service,2"}]},
            {"data": [{"time": "2025-10-01T00:00:00Z", "env": "", "count()": 8, "users": None}]},
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
            mock.patch.object(collection, "raw_snql_query", side_effect=replies) as raw,
            mock.patch.object(Spans, "filter_project", return_value=False),
        ):
            rows = collect(self.organization, [self.project], start, start + 2 * MINUTE, "1m")

        project = str(self.project.id)
        assert rows == [
            (START, "errors", "count()", project, "", "", 8.0),
            (START, "errors", "count_unique(user)", project, "", "", None),
            (
                START + MINUTE,
                "errors_by_release",
                "count()",
                project,
                "prod,blue",
                "service,2",
                4.0,
            ),
            (
                START + MINUTE,
                "errors_by_release",
                "count_unique(user)",
                project,
                "prod,blue",
                "service,2",
                2.0,
            ),
        ]
        for call in raw.call_args_list:
            (request,) = call.args
            request.serialize()
            assert request.dataset == Dataset.Events.value
            assert request.tenant_ids == {"organization_id": self.organization.id}
            assert request.query.where[0].rhs == self.project.id
            assert request.query.where[1].rhs == START.replace(tzinfo=timezone.utc)
            assert request.query.where[2].op == Op.LT
        assert raw.call_args_list[2].args[0].query.granularity.granularity == 60

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
            mock.patch.object(collection, "raw_snql_query", return_value={"data": []}),
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(Spans, "run_table_query", side_effect=discover),
            mock.patch.object(snuba_rpc, "timeseries_rpc", side_effect=timeseries) as rpc,
        ):
            rows = collect(self.organization, [self.project], START, START + 3 * MINUTE, "1m")
        assert grouping_queries == {
            "is_transaction:true",
            "span.category:db",
            "span.op:http.client",
        }
        for call in rpc.call_args_list:
            (request,) = call.args[0]
            assert request.meta.organization_id == self.organization.id
            assert list(request.meta.project_ids) == [self.project.id]
            assert request.granularity_secs == 60
        assert len(rpc.call_args_list) == 5
        project = str(self.project.id)
        assert (START, "requests", "count()", project, env, "", 1000.0) in rows
        assert (START, "requests", "count_sample()", project, env, "", 100.0) in rows
        for metric in ("count()", "count_sample()"):
            assert (START, "failed_requests", metric, project, env, "", 0.0) in rows
            assert (START + MINUTE, "requests", metric, project, env, "", 0.0) in rows
            assert (START + 2 * MINUTE, "requests", metric, project, env, "", 0.0) in rows
        assert all(ts == START for ts, signal, *_ in rows if signal == "failed_requests")
        assert (
            START,
            "endpoints",
            "failure_rate()",
            project,
            env,
            dimensions["transaction"],
            0.0,
        ) in rows
        assert (START, "outbound_db", "p95(span.duration)", project, env, "primary", 30.0) in rows
        assert (
            START + MINUTE,
            "outbound_http",
            "p95(span.duration)",
            project,
            env,
            "example.com",
            None,
        ) in rows
        assert all(
            value is None for ts, _, _, _, _, dim, value in rows if ts == START + MINUTE and dim
        )

    def test_propagates_failure_and_rejects_unexpected_pagination(self) -> None:
        with mock.patch.object(
            collection, "raw_snql_query", side_effect=SnubaError("query failure")
        ):
            with pytest.raises(SnubaError, match="query failure"):
                collect(self.organization, [self.project], START, START + MINUTE, "1m")

        with (
            mock.patch.object(collection, "raw_snql_query", return_value={"data": []}),
            mock.patch.object(Spans, "filter_project", return_value=True),
            mock.patch.object(
                Spans,
                "run_table_query",
                side_effect=[
                    {"data": [{"environment": "prod"}]},
                    {
                        "data": [{"environment": "prod", "transaction": "/foo"}],
                        "page_token": PageToken(end_pagination=False),
                    },
                ],
            ),
            mock.patch.object(snuba_rpc, "timeseries_rpc", return_value=[TimeSeriesResponse()]),
        ):
            with pytest.raises(IncompleteCollection):
                collect(self.organization, [self.project], START, START + MINUTE, "1m")

    def test_hourly_request_and_reject_foreign_project(self) -> None:
        foreign = self.create_project(organization=self.create_organization())
        with mock.patch.object(collection, "raw_snql_query") as raw:
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
                collection,
                "raw_snql_query",
                side_effect=[
                    {"data": [{"env": "test"}]},
                    {"data": []},
                    {"data": []},
                ],
            ) as raw,
            mock.patch.object(Spans, "filter_project", return_value=False),
        ):
            assert (
                collect(self.organization, [self.project], START, START + timedelta(hours=1), "1h")
                == []
            )
        assert raw.call_args.args[0].query.granularity.granularity == 3600

    def test_new_failure_merges_title_and_crosses_on_distinct_users(self) -> None:
        first_seen = (START - MINUTE).replace(tzinfo=timezone.utc)
        first = self.create_group(
            project=self.project, first_seen=first_seen, data={"title": "Timeout", "type": "error"}
        )
        second = self.create_group(
            project=self.project, first_seen=first_seen, data={"title": "Timeout", "type": "error"}
        )
        other = self.create_group(
            project=self.project,
            first_seen=first_seen,
            type=ErrorGroupType.type_id + 1,
            create_open_period=False,
        )
        project = str(self.project.id)
        thresholds = {(project, "prod"): 2.0}
        with mock.patch.object(
            enrichment,
            "_run_errors",
            side_effect=[
                [
                    {"group_id": first.id, "users": 1, "count()": 2},
                    {"group_id": second.id, "users": 1, "count()": 1},
                ],
                [
                    {"timestamp": START - MINUTE, ERROR_USER: "id:a"},
                    {"timestamp": START, ERROR_USER: "id:a"},
                    {"timestamp": START + MINUTE, ERROR_USER: "id:b"},
                ],
            ],
        ) as query:
            (change,) = enrichment.collect_new_failure_modes(
                self.organization,
                [self.project],
                thresholds,
                START,
                START + 2 * MINUTE,
            )
        assert change.key == SeriesKey(
            project, "prod", "new_issue", "count_unique(user)", str(first.id)
        )
        assert change.change_type == ChangeType.NEW_FAILURE_MODE
        assert change.detected_at == START + 2 * MINUTE
        assert change.evidence == ["Timeout", f"issues:{first.id},{second.id}"]
        for call in query.call_args_list:
            (_, snql, _) = call.args
            group_filter = next(
                condition for condition in snql.where if condition.lhs == Column("group_id")
            )
            assert set(group_filter.rhs) == {first.id, second.id}
            assert other.id not in group_filter.rhs

    def test_new_failure_reports_weak_then_strong(self) -> None:
        group = self.create_group(
            project=self.project,
            first_seen=START.replace(tzinfo=timezone.utc),
        )
        thresholds = {(str(self.project.id), "prod"): 12.0}
        early_users = [{"timestamp": START, ERROR_USER: f"id:{index}"} for index in range(10)]
        later_users = [
            {"timestamp": START + MINUTE, ERROR_USER: f"id:{index}"} for index in range(9, 12)
        ]
        with mock.patch.object(
            enrichment,
            "_run_errors",
            side_effect=[
                [{"group_id": group.id, "users": 12, "count()": 13}],
                [*early_users, *later_users],
            ],
        ):
            weak, strong = enrichment.collect_new_failure_modes(
                self.organization,
                [self.project],
                thresholds,
                START,
                START + 2 * MINUTE,
            )
        assert weak.key == strong.key
        assert (weak.detected_at, weak.actual, weak.confidence) == (START + MINUTE, 10.0, 0.5)
        assert (strong.detected_at, strong.actual, strong.confidence) == (
            START + 2 * MINUTE,
            12.0,
            0.9,
        )

    def test_trace_footprint_joins_parent_only_in_same_trace(self) -> None:
        project = str(self.project.id)
        key = SeriesKey(project, "prod", "endpoints", "p95(span.duration)", "GET /x")
        change = ChangeEvent(key, ChangeType.SLOWDOWN, START, 100, 10, 0.9)
        trace1, trace2 = "a" * 32, "b" * 32
        scope = {"project.id": self.project.id, "environment": "prod"}
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
            lookup = enrichment.TraceLookup(self.organization, [self.project])
            footprint = lookup.footprint(change)
            assert footprint is not None
            assert lookup.footprint(change) is footprint
        assert footprint.slices[(project, "prod", "", "")].trace_share == 0.5
        assert footprint.edges == {(f"{project}/prod", "backend", f"{project}/prod"): 1}
        assert table.call_count == 7
        assert table.call_args_list[0].kwargs["config"].filters == (
            ("environment", ("prod",)),
            ("transaction", ("GET /x",)),
        )


def test_failure_thresholds_use_only_observed_hourly_error_users() -> None:
    rows: list[Row] = [
        (START, "errors", "count_unique(user)", "10", "prod", "", 300.0),
        (START + timedelta(hours=1), "errors", "count_unique(user)", "10", "prod", "", None),
        (START, "errors", "count_unique(user)", "10", "stage", "", 5.0),
        (START, "errors_by_release", "count_unique(user)", "10", "stage", "v1", 2000.0),
        (START, "errors", "count_unique(user)", "10", "unobserved", "", None),
    ]
    assert enrichment.new_failure_thresholds(rows) == {("10", "prod"): 15.0, ("10", "stage"): 10.0}
