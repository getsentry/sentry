from datetime import timedelta
from uuid import uuid4

from snuba_sdk import Column, Entity, Limit, Query

from sentry.anomaly_detection.contracts import (
    Metric,
    SeriesKey,
    SeriesRow,
    Signal,
)
from sentry.anomaly_detection.evaluation.series import build
from sentry.anomaly_detection.inputs.measurements import ERROR_USER, MAX_SLICES, collect
from sentry.anomaly_detection.inputs.query import error_where, run_errors
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class TestAnomalyDetectionCollection(TestCase, SnubaTestCase, SpanTestCase):
    def test_collect_errors_excludes_stored_empty_user_from_distinct_count(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        timestamp = start + timedelta(seconds=15)
        group = self.create_group(project=self.project)
        # Insert directly so event normalization cannot discard the empty tag.
        users_by_event = {uuid4().hex: user for user in ("", "id:1", "id:1", "id:2")}
        for event_id, user in users_by_event.items():
            self.snuba_insert(
                (
                    2,
                    "insert",
                    {
                        "event_id": event_id,
                        "primary_hash": "a" * 32,
                        "group_id": group.id,
                        "project_id": self.project.id,
                        "message": "error",
                        "platform": "python",
                        "datetime": timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                        "data": {
                            "received": timestamp.timestamp(),
                            "tags": [["sentry:user", user], ["sentry:release", "v1"]],
                        },
                    },
                    {},
                )
            )

        end = start + timedelta(minutes=1)
        bucket = start.replace(tzinfo=None)
        stored = run_errors(
            self.organization,
            Query(
                match=Entity("events"),
                select=[Column("event_id"), Column(ERROR_USER)],
                where=error_where(self.project, bucket, end.replace(tzinfo=None)),
                limit=Limit(len(users_by_event) + 1),
            ),
            Referrer.ANOMALY_DETECTION_COLLECT.value,
        )
        # The empty-tag event is present, but Snuba does not count it as a third user.
        # Verify presence by event ID without depending on whether SQL returns null or ''.
        assert {row["event_id"]: row[ERROR_USER] or "" for row in stored} == users_by_event

        rows = collect(self.organization, [self.project], start, end, "1m")
        project = self.project.id
        errors, by_release = Signal.ERRORS, Signal.ERRORS_BY_RELEASE
        count, users = Metric.COUNT, Metric.COUNT_UNIQUE_USER
        assert sorted(rows) == [
            SeriesRow(bucket, project, "", errors, count, "", 4.0),
            SeriesRow(bucket, project, "", errors, users, "", 2.0),
            SeriesRow(bucket, project, "", by_release, count, "v1", 4.0),
            SeriesRow(bucket, project, "", by_release, users, "v1", 2.0),
        ]

    def test_collect_errors_counts_distinct_users_within_window(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=3)
        timestamp = start + timedelta(minutes=1, seconds=15)
        for when in (timestamp, timestamp + timedelta(seconds=1), end):
            self.store_event(
                data={
                    "message": "Checkout failed",
                    "environment": "production",
                    "timestamp": when.isoformat(),
                    "tags": {"sentry:user": self.user.email},
                },
                project_id=self.project.id,
            )

        rows = collect(self.organization, [self.project], start, end, "1m")

        bucket = timestamp.replace(second=0, tzinfo=None)
        project = self.project.id
        errors, count, users = Signal.ERRORS, Metric.COUNT, Metric.COUNT_UNIQUE_USER
        before, after = bucket - timedelta(minutes=1), bucket + timedelta(minutes=1)
        assert sorted(rows) == [
            SeriesRow(before, project, "production", errors, count, "", 0.0),
            SeriesRow(before, project, "production", errors, users, "", 0.0),
            SeriesRow(bucket, project, "production", errors, count, "", 2.0),
            SeriesRow(bucket, project, "production", errors, users, "", 1.0),
            SeriesRow(after, project, "production", errors, count, "", 0.0),
            SeriesRow(after, project, "production", errors, users, "", 0.0),
        ]

        # An errors-only scope remains covered after its last error leaves the window.
        quiet_start = end + timedelta(minutes=1)
        quiet_end = quiet_start + timedelta(minutes=1)
        quiet_bucket = quiet_start.replace(tzinfo=None)
        assert collect(self.organization, [self.project], quiet_start, quiet_end, "1m") == [
            SeriesRow(quiet_bucket, project, "production", errors, count, "", 0.0),
            SeriesRow(quiet_bucket, project, "production", errors, users, "", 0.0),
        ]

    def test_collect_request_failures_and_endpoint_latency_within_window(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=3)
        timestamp = start + timedelta(minutes=1, seconds=15)
        endpoint = "GET /checkout"
        self.store_spans(
            [
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {"environment": "production", "transaction": endpoint},
                        "measurements": {"http.response.status_code": {"value": status}},
                    },
                    start_ts=when,
                    duration=duration,
                )
                for when, status, duration in (
                    (timestamp, 503, 250),
                    (timestamp, 200, 250),
                    (end, 503, 900),
                )
            ]
        )

        rows = collect(self.organization, [self.project], start, end, "1m")

        bucket = timestamp.replace(second=0, tzinfo=None)
        project = self.project.id
        assert all(start.replace(tzinfo=None) <= row[0] < end.replace(tzinfo=None) for row in rows)
        totals = {
            (row.ts, row.signal, row.metric): row.value
            for row in rows
            if row.signal in {"requests", "failed_requests"}
        }
        assert totals == {
            (start.replace(tzinfo=None), "requests", "count()"): 0.0,
            (start.replace(tzinfo=None), "requests", "count_sample()"): 0.0,
            (bucket, "failed_requests", "count()"): 1.0,
            (bucket, "failed_requests", "count_sample()"): 1.0,
            (bucket, "requests", "count()"): 2.0,
            (bucket, "requests", "count_sample()"): 2.0,
            (bucket + timedelta(minutes=1), "requests", "count()"): 0.0,
            (bucket + timedelta(minutes=1), "requests", "count_sample()"): 0.0,
        }
        assert [row for row in rows if row.ts == bucket and row.metric == "p95(span.duration)"] == [
            SeriesRow(
                bucket,
                project,
                "production",
                Signal.ENDPOINTS,
                Metric.P95_DURATION,
                endpoint,
                250.0,
            ),
        ]

    def test_collect_distinguishes_omitted_and_literal_none_span_environments(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        timestamp = start + timedelta(seconds=15)
        endpoint = "GET /checkout"
        self.store_spans(
            [
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {"transaction": endpoint, **tags},
                        "measurements": {"http.response.status_code": {"value": status}},
                    },
                    start_ts=timestamp,
                    duration=duration,
                )
                for tags, status, duration in (
                    ({}, 503, 250),
                    ({"environment": "None"}, 200, 500),
                    ({"environment": "None"}, 200, 500),
                )
            ]
        )

        rows = collect(self.organization, [self.project], start, start + timedelta(minutes=2), "1m")
        bucket = start.replace(tzinfo=None)
        idle = bucket + timedelta(minutes=1)
        for metric in ("count()", "count_sample()"):
            assert {
                (ts, signal, env): value
                for ts, _, env, signal, name, _, value in rows
                if name == metric and signal in {"requests", "failed_requests"}
            } == {
                (bucket, "requests", ""): 1.0,
                (bucket, "requests", "None"): 2.0,
                (bucket, "failed_requests", ""): 1.0,
                (bucket, "failed_requests", "None"): 0.0,
                (idle, "requests", ""): 0.0,
                (idle, "requests", "None"): 0.0,
            }
        assert {
            (env, dim): value
            for ts, _, env, signal, metric, dim, value in rows
            if ts == bucket and signal == "endpoints" and metric == "p95(span.duration)"
        } == {("", endpoint): 250.0, ("None", endpoint): 500.0}

    def test_collect_clean_requests_and_outbound_only_environment(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=1)
        timestamp = start + timedelta(seconds=15)
        self.store_spans(
            [
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "environment": "production",
                            "transaction": "GET /checkout",
                        },
                        "measurements": {"http.response.status_code": {"value": 200}},
                    },
                    start_ts=timestamp,
                ),
                self.create_span(
                    {
                        "sentry_tags": {
                            "environment": "worker",
                            "op": "http.client",
                            "domain": "Other",
                        }
                    },
                    start_ts=timestamp,
                    duration=250,
                ),
            ]
        )

        series = build(collect(self.organization, [self.project], start, end, "1m"))

        bucket = start.replace(tzinfo=None)
        project = self.project.id
        assert series[SeriesKey(project, "production", Signal.REQUESTS, Metric.COUNT)] == {
            bucket: 1.0
        }
        assert series[SeriesKey(project, "production", Signal.ERRORS, Metric.COUNT)] == {
            bucket: 0.0
        }
        assert series[
            SeriesKey(project, "production", Signal.ERRORS, Metric.COUNT_UNIQUE_USER)
        ] == {bucket: 0.0}
        assert series[
            SeriesKey(project, "production", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
        ] == {bucket: 0.0}
        assert {key.signal for key in series if key.env == "worker"} == {Signal.OUTBOUND_HTTP}
        assert series[
            SeriesKey(project, "worker", Signal.OUTBOUND_HTTP, Metric.P95_DURATION, "Other")
        ] == {bucket: 250.0}

    def test_unnamed_database_spans_do_not_consume_slice_slots(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=1)
        timestamp = start + timedelta(seconds=15)
        names = {f"database-{index}" for index in range(MAX_SLICES)}
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {"environment": "worker", "category": "db"},
                        "data": attributes,
                    },
                    start_ts=timestamp,
                )
                for attributes in [
                    *({"db.name": name} for name in names),
                    {},
                    {},
                    {"db.name": ""},
                    {"db.name": ""},
                ]
            ]
        )

        rows = collect(self.organization, [self.project], start, end, "1m")

        assert {row.dim_value for row in rows if row.signal == "outbound_db"} == names
