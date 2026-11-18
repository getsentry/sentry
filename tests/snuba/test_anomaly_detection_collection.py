from datetime import timedelta

from sentry.anomaly_detection.collection import collect
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
            (bucket, "errors", "count()", project, "production", "", 2.0),
            (bucket, "errors", "count_unique(user)", project, "production", "", 1.0),
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
