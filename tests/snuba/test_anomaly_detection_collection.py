from datetime import timedelta
from unittest import mock

from sentry.anomaly_detection import enrichment
from sentry.anomaly_detection.collection import MAX_SLICES, collect
from sentry.anomaly_detection.contracts import SeriesKey
from sentry.anomaly_detection.series import build
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class TestAnomalyDetectionCollection(TestCase, SnubaTestCase, SpanTestCase):
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
        project = str(self.project.id)
        assert sorted(rows) == [
            (bucket - timedelta(minutes=1), "errors", "count()", project, "production", "", 0.0),
            (
                bucket - timedelta(minutes=1),
                "errors",
                "count_unique(user)",
                project,
                "production",
                "",
                0.0,
            ),
            (bucket, "errors", "count()", project, "production", "", 2.0),
            (bucket, "errors", "count_unique(user)", project, "production", "", 1.0),
            (bucket + timedelta(minutes=1), "errors", "count()", project, "production", "", 0.0),
            (
                bucket + timedelta(minutes=1),
                "errors",
                "count_unique(user)",
                project,
                "production",
                "",
                0.0,
            ),
        ]

        # An errors-only scope remains covered after its last error leaves the window.
        quiet_start = end + timedelta(minutes=1)
        quiet_end = quiet_start + timedelta(minutes=1)
        quiet_bucket = quiet_start.replace(tzinfo=None)
        assert collect(self.organization, [self.project], quiet_start, quiet_end, "1m") == [
            (quiet_bucket, "errors", "count()", project, "production", "", 0.0),
            (quiet_bucket, "errors", "count_unique(user)", project, "production", "", 0.0),
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
        project = str(self.project.id)
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
            (bucket, "endpoints", "p95(span.duration)", project, "production", endpoint, 250.0),
        ]

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
        project = str(self.project.id)
        assert series[SeriesKey(project, "production", "requests", "count()")] == {bucket: 1.0}
        assert series[SeriesKey(project, "production", "errors", "count()")] == {bucket: 0.0}
        assert series[SeriesKey(project, "production", "errors", "count_unique(user)")] == {
            bucket: 0.0
        }
        assert series[SeriesKey(project, "production", "error_rate", "errors/requests")] == {
            bucket: 0.0
        }
        assert {key.signal for key in series if key.env == "worker"} == {"outbound_http"}
        assert series[
            SeriesKey(project, "worker", "outbound_http", "p95(span.duration)", "Other")
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
    def test_crosses_after_repeated_errors_and_ignores_anonymous_events(self) -> None:
        start = before_now(minutes=20).replace(second=0, microsecond=0)
        late = start + timedelta(minutes=2)
        end = late + timedelta(minutes=1)
        for user, when in (
            *(("repeat", start) for _ in range(12)),
            *((f"user-{i}", start) for i in range(1, 9)),
            (None, start),
            ("user-9", late),
        ):
            self.store_event(
                data={
                    "message": "Checkout failed",
                    "environment": "new-env",
                    "timestamp": when.isoformat(),
                    "user": {"id": user} if user is not None else {},
                },
                project_id=self.project.id,
            )

        # Force a small SnQL page to exercise aggregate ordering and pagination.
        with mock.patch.object(enrichment, "_ISSUE_USER_PAGE_SIZE", 4):
            (change,) = enrichment.collect_new_failure_modes(
                self.organization,
                [self.project],
                {},
                start,
                end,
                current_rows=[
                    (late, "errors", "count()", str(self.project.id), "new-env", "", 1.0),
                ],
            )

        assert change.detected_at == end.replace(tzinfo=None)
        assert change.actual == change.expected == 10
