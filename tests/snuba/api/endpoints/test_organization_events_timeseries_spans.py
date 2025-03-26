from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase

pytestmark = pytest.mark.sentry_metrics


def _timeseries(start, interval, expected, expected_comparison=None):
    if expected_comparison is not None:
        assert len(expected_comparison) == len(expected)
        return [
            {
                "timestamp": start.timestamp() * 1000 + interval * index,
                "value": value,
                "comparisonValue": expected_comparison[index],
            }
            for index, value in enumerate(expected)
        ]
    return [
        {
            "timestamp": start.timestamp() * 1000 + interval * index,
            "value": value,
        }
        for index, value in enumerate(expected)
    ]


class OrganizationEventsStatsSpansMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=6)
        self.two_days_ago = self.day_ago - timedelta(days=1)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True, "organizations:global-views": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_count(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1
        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_counts)
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

    def test_handle_nans_from_snuba(self):
        self.store_spans(
            [self.create_span({"description": "foo"}, start_ts=self.start)],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "yAxis": "avg(measurements.lcp)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content

    def test_handle_nans_from_snuba_top_n(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "measurements": {"lcp": {"value": 1}},
                    },
                    start_ts=self.start,
                ),
                self.create_span({"description": "foo"}, start_ts=self.start),
                self.create_span({"description": "foo"}, start_ts=self.two_days_ago),
                self.create_span(
                    {
                        "description": "bar",
                        "measurements": {"lcp": {"value": 2}},
                    },
                    start_ts=self.start,
                ),
                self.create_span({"description": "bar"}, start_ts=self.start),
                self.create_span({"description": "bar"}, start_ts=self.two_days_ago),
            ],
            is_eap=True,
        )
        seven_days_ago = self.two_days_ago - timedelta(days=5)

        response = self._do_request(
            data={
                "field": ["span.description", "p50(measurements.lcp)", "avg(measurements.lcp)"],
                "yAxis": ["p50(measurements.lcp)", "avg(measurements.lcp)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 1,
                "per_page": 50,
                "interval": "1d",
                "start": seven_days_ago,
                "end": self.end,
                "orderby": "-avg(measurements.lcp)",
            },
        )
        interval = 24 * 60 * 60 * 1000
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": seven_days_ago.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 4
        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 7
        assert timeseries["axis"] == "p50(measurements.lcp)"
        assert timeseries["values"] == _timeseries(seven_days_ago, interval, [0, 0, 0, 0, 0, 0, 2])
        assert timeseries["groupBy"] == [{"span.description": "bar"}]
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 7
        assert timeseries["axis"] == "avg(measurements.lcp)"
        assert timeseries["values"] == _timeseries(seven_days_ago, interval, [0, 0, 0, 0, 0, 0, 2])
        assert timeseries["groupBy"] == [{"span.description": "bar"}]
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][2]
        assert len(timeseries["values"]) == 7
        assert timeseries["axis"] == "p50(measurements.lcp)"
        assert timeseries["values"] == _timeseries(seven_days_ago, interval, [0, 0, 0, 0, 0, 0, 1])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": True,
            "order": 1,
        }

        timeseries = response.data["timeseries"][3]
        assert len(timeseries["values"]) == 7
        assert timeseries["axis"] == "avg(measurements.lcp)"
        assert timeseries["values"] == _timeseries(seven_days_ago, interval, [0, 0, 0, 0, 0, 0, 1])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": True,
            "order": 1,
        }

    def test_count_unique(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "tags": {"foo": f"foo-{minute}"},
                        },
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count_unique(foo)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1
        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count_unique(foo)"
        assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_counts)
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

    def test_p95(self):
        event_durations = [6, 0, 6, 3, 0, 3]
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    duration=duration,
                    start_ts=self.start + timedelta(hours=hour, minutes=1),
                )
                for hour, duration in enumerate(event_durations)
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "p95()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1
        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "p95()"
        assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_durations)
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 3_600_000,
        }

    def test_multiaxis(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                        },
                        duration=count,
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["count()", "p95()"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 2

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_counts)
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "p95()"
        assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_counts)
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 3_600_000,
        }

    def test_top_events(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2001,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "bar", "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "baz", "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=1999,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "qux", "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=1998,
                ),
            ],
            is_eap=True,
        )

        self.end = self.start + timedelta(minutes=6)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 3

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "foo"}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "bar"}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeseries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 2, 0, 0, 0, 0])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_empty_other(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2000 if transaction == "foo" else 1999,
                )
                for transaction in ["foo", "bar"]
            ],
            is_eap=True,
        )

        self.end = self.start + timedelta(minutes=6)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 2

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "foo"}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "bar"}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

    def test_top_events_multi_y_axis(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2000,
                )
                for transaction in ["foo", "bar", "baz"]
            ],
            is_eap=True,
        )

        self.end = self.start + timedelta(minutes=6)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": ["count()", "p50(span.duration)"],
                "field": ["transaction", "count()", "p50(span.duration)"],
                "orderby": ["transaction"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 6

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "bar"}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "p50(span.duration)"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 2000, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "bar"}]
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "baz"}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeseries"][3]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "p50(span.duration)"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 2000, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"transaction": "baz"}]
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeseries"][4]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

        timeseries = response.data["timeseries"][5]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "p50(span.duration)"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 2000, 0, 0, 0, 0])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_with_project(self):
        projects = [self.create_project(), self.create_project()]
        spans = [
            self.create_span(
                {"sentry_tags": {"status": "success"}},
                start_ts=self.start + timedelta(minutes=1),
                project=project,
                duration=2000 - index,
            )
            for index, project in enumerate(projects)
        ]
        spans.append(
            self.create_span(
                {"segment_name": "baz", "sentry_tags": {"status": "success"}},
                start_ts=self.start + timedelta(minutes=1),
                duration=1,
            )
        )
        self.store_spans(spans, is_eap=True)

        self.end = self.start + timedelta(minutes=6)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 3

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"project": projects[0].slug}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [{"project": projects[1].slug}]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeseries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_with_project_and_project_id(self):
        projects = [self.create_project(), self.create_project()]
        spans = [
            self.create_span(
                {"sentry_tags": {"status": "success"}},
                start_ts=self.start + timedelta(minutes=1),
                project=project,
                duration=2000 - index,
            )
            for index, project in enumerate(projects)
        ]
        spans.append(
            self.create_span(
                {"segment_name": "baz", "sentry_tags": {"status": "success"}},
                start_ts=self.start + timedelta(minutes=1),
            )
        )
        self.store_spans(spans, is_eap=True)

        self.end = self.start + timedelta(minutes=6)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 3

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [
            {"project": projects[0].slug},
            {"project.id": str(projects[0].id)},
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeseries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] == [
            {"project": projects[1].slug},
            {"project.id": str(projects[1].id)},
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeseries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0, 1, 0, 0, 0, 0])
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_with_no_data(self):
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

    def test_count_extrapolation(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "measurements": {"client_sample_rate": {"value": 0.1}},
                        },
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(
            self.start, 3_600_000, [val * 10 for val in event_counts]
        )
        assert timeseries["accuracy"] == {
            "sampleCount": _timeseries(self.start, 3_600_000, event_counts),
            "sampleRate": _timeseries(
                self.start, 3_600_000, [pytest.approx(0.1) if val else 0 for val in event_counts]
            ),
            "confidence": _timeseries(
                self.start, 3_600_000, ["low" if val else None for val in event_counts]
            ),
        }
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

    def test_confidence_is_set(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "measurements": {"client_sample_rate": {"value": 0.1}},
                        },
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        y_axes = [
            "count()",
            "count(span.duration)",
            "sum(span.duration)",
            "avg(span.duration)",
            "p50(span.duration)",
            "p75(span.duration)",
            "p90(span.duration)",
            "p95(span.duration)",
            "p99(span.duration)",
        ]

        for y_axis in y_axes:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "1h",
                    "yAxis": y_axis,
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
            assert response.status_code == 200, (y_axis, response.content)
            assert response.data["meta"] == {
                "dataset": "spans",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
            }
            assert len(response.data["timeseries"]) == 1

            timeseries = response.data["timeseries"][0]
            assert len(timeseries["values"]) == 6
            assert timeseries["axis"] == y_axis
            assert timeseries["accuracy"]["sampleCount"] == _timeseries(
                self.start, 3_600_000, event_counts
            )
            assert timeseries["accuracy"]["sampleRate"] == _timeseries(
                self.start, 3_600_000, [pytest.approx(0.1) if val else 0 for val in event_counts]
            )
            for confidence, value in zip(timeseries["accuracy"]["confidence"], event_counts):
                if value:
                    assert confidence["value"] in ("high", "low")
                else:
                    assert confidence["value"] is None

    def test_extrapolation_with_multiaxis(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "measurements": {"client_sample_rate": {"value": 0.1}},
                        },
                        duration=count,
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["count()", "p95()"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 2

        for index, y_axis in enumerate(["count()", "p95()"]):
            timeseries = response.data["timeseries"][index]
            assert len(timeseries["values"]) == 6
            assert timeseries["axis"] == y_axis
            assert timeseries["accuracy"]["sampleCount"] == _timeseries(
                self.start, 3_600_000, event_counts
            )
            assert timeseries["accuracy"]["sampleRate"] == _timeseries(
                self.start, 3_600_000, [pytest.approx(0.1) if val else 0 for val in event_counts]
            )
            for confidence, value in zip(timeseries["accuracy"]["confidence"], event_counts):
                if value:
                    assert confidence["value"] in ("high", "low")
                else:
                    assert confidence["value"] is None

    def test_top_events_with_extrapolation(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "foo", "status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.1}},
                    },
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "bar", "status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.1}},
                    },
                    start_ts=self.start + timedelta(minutes=1),
                    duration=1999,
                ),
                self.create_span(
                    {
                        "segment_name": "baz",
                        "sentry_tags": {"status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.1}},
                    },
                    start_ts=self.start + timedelta(minutes=1),
                    duration=1998,
                ),
            ],
            is_eap=True,
        )
        event_counts = [0, 1, 0, 0, 0, 0]

        self.end = self.start + timedelta(minutes=6)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 3

        for index, groupby in enumerate(["foo", "bar", None]):
            timeseries = response.data["timeseries"][index]
            assert len(timeseries["values"]) == 6
            assert timeseries["axis"] == "count()"
            if groupby is not None:
                assert timeseries["groupBy"] == [{"transaction": groupby}]
            else:
                assert timeseries["groupBy"] is None
            assert timeseries["accuracy"]["sampleCount"] == _timeseries(
                self.start, 60_000, event_counts
            )
            assert timeseries["accuracy"]["sampleRate"] == _timeseries(
                self.start, 60_000, [pytest.approx(0.1) if val else 0 for val in event_counts]
            )
            for confidence, value in zip(timeseries["accuracy"]["confidence"], event_counts):
                if value:
                    assert confidence["value"] in ("high", "low")
                else:
                    assert confidence["value"] is None

    def test_comparison_delta(self):
        event_counts = [6, 0, 6, 4, 0, 4]
        spans = []
        for current_period in [True, False]:
            for hour, count in enumerate(event_counts):
                count = count if current_period else int(count / 2)
                spans.extend(
                    [
                        self.create_span(
                            {"description": "foo", "sentry_tags": {"status": "success"}},
                            start_ts=(
                                self.start + timedelta(hours=hour, minutes=minute)
                                if current_period
                                else self.two_days_ago + timedelta(hours=hour, minutes=minute)
                            ),
                        )
                        for minute in range(count)
                    ],
                )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(
            self.start, 3_600_000, event_counts, [value / 2 for value in event_counts]
        )
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

    def test_comparison_delta_with_empty_comparison_values(self):
        event_counts = [6, 0, 6, 4, 0, 4]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["axis"] == "count()"
        assert timeseries["values"] == _timeseries(
            self.start, 3_600_000, event_counts, [0] * len(event_counts)
        )
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

    def test_invalid_intervals(self):
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(minutes=6),
                "interval": "20s",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 400, response.content

    def test_project_filters(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        for querystring in [f"project:{self.project.slug}", f"project:[{self.project.slug}]"]:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "1h",
                    "yAxis": "count()",
                    "query": querystring,
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
            assert response.status_code == 200, response.content
            assert response.data["meta"] == {
                "dataset": "spans",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
            }
            assert len(response.data["timeseries"]) == 1

            timeseries = response.data["timeseries"][0]
            assert len(timeseries["values"]) == 6
            assert timeseries["axis"] == "count()"
            assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_counts)
            assert timeseries["meta"] == {
                "valueType": "integer",
                "interval": 3_600_000,
            }

    def test_nonexistent_project_filter(self):
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "query": "project:foobar",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 400, response.content
        assert "Unknown value foobar" in response.data["detail"]

    def test_device_class_filter(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success", "device.class": "1"},
                        },
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        for querystring in ["device.class:low", "device.class:[low,medium]"]:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "1h",
                    "yAxis": "count()",
                    "query": querystring,
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
            assert response.status_code == 200, response.content
            assert response.data["meta"] == {
                "dataset": "spans",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
            }
            assert len(response.data["timeseries"]) == 1

            timeseries = response.data["timeseries"][0]
            assert len(timeseries["values"]) == 6
            assert timeseries["axis"] == "count()"
            assert timeseries["values"] == _timeseries(self.start, 3_600_000, event_counts)
            assert timeseries["meta"] == {
                "valueType": "integer",
                "interval": 3_600_000,
            }

    def test_top_events_filters_out_groupby_even_when_its_just_one_row(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count(span.self_time)",
                "field": ["transaction", "count(span.self_time)"],
                "query": "count(span.self_time):>4",
                "orderby": ["-count(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 5,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 0

    def test_interval_larger_than_period_uses_default_period(self):
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "12h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }

        timeseries = response.data["timeseries"][0]
        assert timeseries["axis"] == "count()"
        assert len(timeseries["values"]) == 73
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 300_000,
        }

    def test_cache_miss_rate(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "data": {"cache.hit": False},
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": False},
                    },
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        self.end = self.start + timedelta(minutes=3)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "cache_miss_rate()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["axis"] == "cache_miss_rate()"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0.0, 1.0, 0.25])
        assert timeseries["meta"] == {
            "valueType": "percentage",
            "interval": 60_000,
        }

    def test_trace_status_rate(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"trace.status": "ok"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "unauthenticated"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "ok"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "ok"}},
                    start_ts=self.start + timedelta(minutes=2),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "unknown"}},
                    start_ts=self.start + timedelta(minutes=2),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "ok"}},
                    start_ts=self.start + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        self.end = self.start + timedelta(minutes=3)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "trace_status_rate(ok)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["axis"] == "trace_status_rate(ok)"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0.0, 0.5, 0.75])
        assert timeseries["meta"] == {
            "valueType": "percentage",
            "interval": 60_000,
        }

    def test_count_op(self):
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.start + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        self.end = self.start + timedelta(minutes=3)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count_op(queue.publish)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1

        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["axis"] == "count_op(queue.publish)"
        assert timeseries["values"] == _timeseries(self.start, 60_000, [0.0, 2.0, 1.0])
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 60_000,
        }
