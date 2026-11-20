from collections.abc import Mapping
from datetime import datetime, timedelta
from unittest import mock
from uuid import uuid4

from snuba_sdk import Column, Entity, Limit, Query

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    Metric,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
)
from sentry.anomaly_detection.evaluation.series import build
from sentry.anomaly_detection.inputs import new_failures
from sentry.anomaly_detection.inputs.measurements import ERROR_USER, MAX_SLICES, collect
from sentry.anomaly_detection.inputs.new_failures import (
    NewFailureThresholds,
    new_failure_thresholds,
)
from sentry.anomaly_detection.inputs.query import error_where, run_errors
from sentry.models.group import Group
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
            SeriesRow(bucket, errors, count, project, "", "", 4.0),
            SeriesRow(bucket, errors, users, project, "", "", 2.0),
            SeriesRow(bucket, by_release, count, project, "", "v1", 4.0),
            SeriesRow(bucket, by_release, users, project, "", "v1", 2.0),
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
            SeriesRow(before, errors, count, project, "production", "", 0.0),
            SeriesRow(before, errors, users, project, "production", "", 0.0),
            SeriesRow(bucket, errors, count, project, "production", "", 2.0),
            SeriesRow(bucket, errors, users, project, "production", "", 1.0),
            SeriesRow(after, errors, count, project, "production", "", 0.0),
            SeriesRow(after, errors, users, project, "production", "", 0.0),
        ]

        # An errors-only scope remains covered after its last error leaves the window.
        quiet_start = end + timedelta(minutes=1)
        quiet_end = quiet_start + timedelta(minutes=1)
        quiet_bucket = quiet_start.replace(tzinfo=None)
        assert collect(self.organization, [self.project], quiet_start, quiet_end, "1m") == [
            SeriesRow(quiet_bucket, errors, count, project, "production", "", 0.0),
            SeriesRow(quiet_bucket, errors, users, project, "production", "", 0.0),
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
        totals = {row[:3]: row[-1] for row in rows if row[1] in {"requests", "failed_requests"}}
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
        assert [row for row in rows if row[0] == bucket and row[2] == "p95(span.duration)"] == [
            SeriesRow(
                bucket,
                Signal.ENDPOINTS,
                Metric.P95_DURATION,
                project,
                "production",
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
                for ts, signal, name, _, env, _, value in rows
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
            for ts, signal, metric, _, env, dim, value in rows
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

        assert {row[5] for row in rows if row[1] == "outbound_db"} == names


class TestAnomalyDetectionIssueEnrichment(TestCase, SnubaTestCase):
    def _group(self, first_seen: datetime, message: str = "Checkout failed") -> Group:
        return self.create_group(project=self.project, first_seen=first_seen, message=message)

    def _error(
        self,
        group: Group,
        user: str | None,
        timestamp: datetime,
        received: datetime | None = None,
    ) -> None:
        # Insert directly: ingestion would stamp the wall clock as receive time.
        tags = [["environment", "prod"]]
        if user is not None:
            tags.append(["sentry:user", user])
        received = received or timestamp + timedelta(seconds=5)
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid4().hex,
                    "primary_hash": uuid4().hex,
                    "group_id": group.id,
                    "project_id": self.project.id,
                    "message": group.message,
                    "platform": "python",
                    "datetime": timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {"received": received.timestamp(), "tags": tags},
                },
                {},
            )
        )

    def _collect(
        self,
        thresholds: NewFailureThresholds | Mapping[Service, float],
        start: datetime,
        end: datetime,
    ) -> list[ChangeEvent]:
        return new_failures.collect_new_failure_modes(
            self.organization, [self.project], thresholds, start, end
        )

    def test_crosses_once_across_adjacent_runs_and_ignores_anonymous_events(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        late = start + timedelta(minutes=2)
        end = late + timedelta(minutes=1)
        group = self._group(start)
        for user, when in (
            *(("repeat", start) for _ in range(12)),
            *((f"user-{i}", start) for i in range(1, 9)),
            (None, start),
            ("user-9", late),
            ("user-10", end),
        ):
            self._error(group, user, when)
        thresholds = {Service(self.project.id, "prod"): 11.0}

        # Force a small SnQL page to exercise aggregate ordering and pagination.
        with mock.patch.object(new_failures, "_ISSUE_USER_PAGE_SIZE", 4):
            (weak,) = self._collect(thresholds, start, end)
            # The next run replays the weak milestone at its start and excludes it.
            (strong,) = self._collect(thresholds, end, end + timedelta(minutes=1))

        assert (weak.detected_at, weak.actual, weak.confidence) == (
            end.replace(tzinfo=None),
            10,
            0.5,
        )
        assert (strong.detected_at, strong.actual, strong.confidence) == (
            (end + timedelta(minutes=1)).replace(tzinfo=None),
            11,
            0.9,
        )
        assert weak.key == strong.key
        assert weak.start == strong.start == start.replace(tzinfo=None)

    def test_hourly_thresholds_scale_with_service_audience(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        hour = start.replace(minute=0, tzinfo=None)
        thresholds = new_failure_thresholds(
            [
                SeriesRow(
                    hour - timedelta(hours=offset),
                    Signal.ERRORS,
                    Metric.COUNT_UNIQUE_USER,
                    self.project.id,
                    "prod",
                    "",
                    users,
                )
                for offset, users in ((1, 240.0), (2, 200.0), (3, 300.0))
            ]
        )
        group = self._group(start)
        for i in range(10):
            self._error(group, f"user-{i}", start)
        for i in range(10, 12):
            self._error(group, f"user-{i}", start + timedelta(minutes=1))

        weak, strong = self._collect(thresholds, start, start + timedelta(minutes=2))

        # 5% of the median hourly audience, 240 users, sets the bar at 12.
        assert (weak.detected_at, weak.actual, weak.expected) == (
            (start + timedelta(minutes=1)).replace(tzinfo=None),
            10,
            12.0,
        )
        assert (strong.detected_at, strong.actual, strong.expected) == (
            (start + timedelta(minutes=2)).replace(tzinfo=None),
            12,
            12.0,
        )

    def test_merges_groups_with_one_title_and_counts_shared_users_once(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        first = self._group(start)
        second = self._group(start + timedelta(minutes=1))
        self._group(start, message="Unrelated failure")
        for i in range(6):
            self._error(first, f"user-{i}", start)
        for i in range(6, 10):
            self._error(second, f"user-{i}", start + timedelta(minutes=1))
        # A user already counted through the first group is not a new user.
        self._error(second, "user-0", start + timedelta(minutes=2))

        (change,) = self._collect(
            {Service(self.project.id, "prod"): 11.0}, start, start + timedelta(minutes=3)
        )

        assert change.key.dim_value == str(first.id)
        assert change.issue_ids == (first.id, second.id)
        assert change.evidence == ["Checkout failed"]
        assert (change.detected_at, change.actual, change.confidence) == (
            (start + timedelta(minutes=2)).replace(tzinfo=None),
            10,
            0.5,
        )

    def test_late_event_is_observed_when_received(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        group = self._group(start - timedelta(minutes=10))
        for i in range(9):
            self._error(group, f"user-{i}", start - timedelta(minutes=10))
        # Buffered on the client: it happened early but reached Sentry after start.
        self._error(
            group,
            "user-late",
            start - timedelta(minutes=9),
            received=start + timedelta(seconds=20),
        )

        # The run that closed before the event arrived could not have seen it.
        assert self._collect({}, start - timedelta(minutes=1), start) == []
        (change,) = self._collect({}, start, start + timedelta(minutes=1))

        assert change.detected_at == (start + timedelta(minutes=1)).replace(tzinfo=None)
        assert change.actual == change.expected == 10
        assert change.start == (start - timedelta(minutes=10)).replace(tzinfo=None)

    def test_late_event_alone_is_observed_in_an_otherwise_silent_window(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=1)
        onset = start - timedelta(minutes=30)
        group = self._group(onset)
        for i in range(9):
            self._error(group, f"user-{i}", onset)
        # The only error received in the window happened 25 minutes earlier.
        self._error(group, "user-late", onset + timedelta(minutes=5), received=start)
        # Counted by event time, the window has no errors at all.
        window_rows = collect(self.organization, [self.project], start, end, "1m")
        assert not any(row.value for row in window_rows if row.signal == Signal.ERRORS)

        (change,) = self._collect({Service(self.project.id, "prod"): 10.0}, start, end)

        assert change.key.env == "prod"
        assert change.detected_at == end.replace(tzinfo=None)
        assert change.actual == 10
