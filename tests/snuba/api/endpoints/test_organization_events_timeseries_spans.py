from datetime import timedelta
from unittest import mock

import pytest
from django.urls import reverse
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba_rpc import _make_rpc_requests
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase
from tests.snuba.api.endpoints.test_organization_events_span_indexed import KNOWN_PREFLIGHT_ID

pytestmark = pytest.mark.sentry_metrics


def build_expected_timeseries(
    start,
    interval,
    expected,
    expected_comparison=None,
    ignore_accuracy=False,
    sample_count=None,
    sample_rate=None,
    confidence=None,
):
    if expected_comparison is not None:
        assert len(expected_comparison) == len(expected)
    if ignore_accuracy:
        sample_count = [mock.ANY for val in expected]
        sample_rate = [mock.ANY for val in expected]
        confidence = [mock.ANY for val in expected]
    else:
        if sample_count is not None:
            assert len(sample_count) == len(expected)
        if sample_rate is not None:
            assert len(sample_rate) == len(expected)
        if confidence is not None:
            assert len(confidence) == len(expected)

    expected_value = []
    for index, value in enumerate(expected):
        current_value = {
            "incomplete": False,
            "timestamp": start.timestamp() * 1000 + interval * index,
            "value": value,
        }
        if expected_comparison is not None:
            current_value["comparisonValue"] = expected_comparison[index]
        if sample_count is not None:
            current_value["sampleCount"] = sample_count[index]
        if sample_rate is not None:
            current_value["sampleRate"] = sample_rate[index]
        if confidence is not None:
            current_value["confidence"] = confidence[index]
        expected_value.append(current_value)
    return expected_value


class AnyConfidence:
    def __eq__(self, o: object):
        return o in ["high", "low"]


any_confidence = AnyConfidence()


class OrganizationEventsStatsSpansMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self) -> None:
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
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_count(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            event_counts,
            sample_count=event_counts,
            sample_rate=[1 if val else None for val in event_counts],
            confidence=[any_confidence if val else None for val in event_counts],
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_handle_nans_from_snuba(self) -> None:
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

    def test_handle_nans_from_snuba_top_n(self) -> None:
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
                "groupBy": ["span.description", "p50(measurements.lcp)", "avg(measurements.lcp)"],
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

        rounded_start = seven_days_ago.replace(hour=0, minute=0)
        rounded_end = rounded_start + timedelta(days=7)
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": rounded_start.timestamp() * 1000,
            "end": rounded_end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 4
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 7
        assert timeseries["yAxis"] == "p50(measurements.lcp)"
        assert timeseries["values"] == build_expected_timeseries(
            rounded_start, interval, [0, 0, 0, 0, 0, 0, 2], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "span.description", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 7
        assert timeseries["yAxis"] == "avg(measurements.lcp)"
        assert timeseries["values"] == build_expected_timeseries(
            rounded_start, interval, [0, 0, 0, 0, 0, 0, 2], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "span.description", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 7
        assert timeseries["yAxis"] == "p50(measurements.lcp)"
        assert timeseries["values"] == build_expected_timeseries(
            rounded_start, interval, [0, 0, 0, 0, 0, 0, 1], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": True,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][3]
        assert len(timeseries["values"]) == 7
        assert timeseries["yAxis"] == "avg(measurements.lcp)"
        assert timeseries["values"] == build_expected_timeseries(
            rounded_start, interval, [0, 0, 0, 0, 0, 0, 1], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": interval,
            "isOther": True,
            "order": 1,
        }

    def test_count_unique(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count_unique(foo)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_counts, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_p95(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "p95()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_durations, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 3_600_000,
        }

    def test_multiaxis(self) -> None:
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
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_counts, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "p95()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_counts, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 3_600_000,
        }

    def test_top_events(self) -> None:
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
                "groupBy": ["transaction", "sum(span.self_time)"],
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
        assert len(response.data["timeSeries"]) == 3

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "foo"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_orderby_not_in_groupby(self) -> None:
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
                "groupBy": ["transaction"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 400, response.content
        assert "orderby must also be in the selected columns or groupby" == response.data["detail"]

    def test_top_events_orderby_is_timestamp(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "groupBy": ["transaction"],
                "orderby": ["timestamp"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 400, response.content
        assert "Cannot order by timestamp" == response.data["detail"]

    def test_top_events_with_none_as_groupby(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "foo"}, "tags": {"foo": "a"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2001,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "bar"}, "tags": {"foo": "b"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=2000,
                ),
                # Without the foo tag this groupby will be None
                self.create_span(
                    {"sentry_tags": {"transaction": "baz"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=1999,
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
                "groupBy": ["foo", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 3,
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 3

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "foo", "value": "a"},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "foo", "value": "b"},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "foo", "value": None},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 2,
        }

    def test_top_events_empty_other(self) -> None:
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
                "groupBy": ["transaction", "sum(span.self_time)"],
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
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "foo"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

    def test_top_events_exclude_other(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.start + timedelta(minutes=1),
                    duration=duration,
                )
                for transaction, duration in [("foo", 2000), ("bar", 1999), ("quz", 100)]
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
                "groupBy": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 1,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "foo"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

    def test_top_events_multi_y_axis(self) -> None:
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
                "groupBy": ["transaction", "count()", "p50(span.duration)"],
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
        assert len(response.data["timeSeries"]) == 6

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "p50(span.duration)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2000, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "bar"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "baz"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][3]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "p50(span.duration)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2000, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "transaction", "value": "baz"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][4]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

        timeseries = response.data["timeSeries"][5]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "p50(span.duration)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2000, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_with_project(self) -> None:
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
                "groupBy": ["project", "sum(span.self_time)"],
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
        assert len(response.data["timeSeries"]) == 3

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "project", "value": projects[0].slug}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "project", "value": projects[1].slug}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_with_project_and_project_id(self) -> None:
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
                "groupBy": ["project", "project.id", "sum(span.self_time)"],
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
        assert len(response.data["timeSeries"]) == 3

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "project", "value": projects[0].slug},
            {"key": "project.id", "value": str(projects[0].id)},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "project", "value": projects[1].slug},
            {"key": "project.id", "value": str(projects[1].id)},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_top_events_with_no_data(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "groupBy": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

    def test_top_events_without_groupby(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["count()"],
                "orderby": ["-count()"],
                "topEvents": 5,
                "dataset": "spans",
            },
        )

        assert response.status_code == 400, response.content
        assert "groupBy is a required" in response.data["detail"]

    def test_count_extrapolation(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            [val * 10 for val in event_counts],
            sample_count=event_counts,
            sample_rate=[pytest.approx(0.1) if val else None for val in event_counts],
            confidence=["low" if val else None for val in event_counts],
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_confidence_is_set(self) -> None:
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
            assert len(response.data["timeSeries"]) == 1

            timeseries = response.data["timeSeries"][0]
            assert len(timeseries["values"]) == 6
            assert timeseries["yAxis"] == y_axis
            if y_axis.startswith("count"):
                expected_values = [val * 10 for val in event_counts]
            elif y_axis == "sum(span.duration)":
                expected_values = [val * 10000 for val in event_counts]
            else:
                expected_values = [1000 if val else 0 for val in event_counts]
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                3_600_000,
                expected_values,
                sample_count=event_counts,
                sample_rate=[pytest.approx(0.1) if val else None for val in event_counts],
                confidence=[any_confidence if val else None for val in event_counts],
            ), y_axis

    def test_extrapolation_with_multiaxis(self) -> None:
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
        assert len(response.data["timeSeries"]) == 2

        for index, y_axis in enumerate(["count()", "p95()"]):
            timeseries = response.data["timeSeries"][index]
            assert len(timeseries["values"]) == 6
            assert timeseries["yAxis"] == y_axis
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                3_600_000,
                [val * 10 if y_axis == "count()" else val for val in event_counts],
                sample_count=event_counts,
                sample_rate=[pytest.approx(0.1) if val else None for val in event_counts],
                confidence=[any_confidence if val else None for val in event_counts],
            )

    def test_top_events_with_extrapolation(self) -> None:
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
                "groupBy": ["transaction", "sum(span.self_time)"],
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
        assert len(response.data["timeSeries"]) == 3

        for index, groupby in enumerate(["foo", "bar", None]):
            timeseries = response.data["timeSeries"][index]
            assert len(timeseries["values"]) == 6
            assert timeseries["yAxis"] == "count()"
            if groupby is not None:
                assert timeseries["groupBy"] == [{"key": "transaction", "value": groupby}]
            else:
                assert timeseries["groupBy"] is None
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                60_000,
                [val * 10 for val in event_counts],
                sample_count=event_counts,
                sample_rate=[pytest.approx(0.1) if val else None for val in event_counts],
                confidence=[any_confidence if val else None for val in event_counts],
            )

    def test_comparison_delta(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            event_counts,
            [value / 2 for value in event_counts],
            ignore_accuracy=True,
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_comparison_delta_with_empty_comparison_values(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_counts, [0] * len(event_counts), ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_invalid_intervals(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "groupBy": ["transaction", "sum(span.self_time)"],
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
                "groupBy": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 400, response.content

    def test_project_filters(self) -> None:
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
            assert len(response.data["timeSeries"]) == 1

            timeseries = response.data["timeSeries"][0]
            assert len(timeseries["values"]) == 6
            assert timeseries["yAxis"] == "count()"
            assert timeseries["values"] == build_expected_timeseries(
                self.start, 3_600_000, event_counts, ignore_accuracy=True
            )
            assert timeseries["meta"] == {
                "dataScanned": "full",
                "valueType": "integer",
                "valueUnit": None,
                "interval": 3_600_000,
            }

    def test_nonexistent_project_filter(self) -> None:
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

    def test_device_class_filter(self) -> None:
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
            assert len(response.data["timeSeries"]) == 1

            timeseries = response.data["timeSeries"][0]
            assert len(timeseries["values"]) == 6
            assert timeseries["yAxis"] == "count()"
            assert timeseries["values"] == build_expected_timeseries(
                self.start, 3_600_000, event_counts, ignore_accuracy=True
            )
            assert timeseries["meta"] == {
                "dataScanned": "full",
                "valueType": "integer",
                "valueUnit": None,
                "interval": 3_600_000,
            }

    def test_top_events_filters_out_groupby_even_when_its_just_one_row(self) -> None:
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
                "groupBy": ["transaction", "count(span.self_time)"],
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
        assert len(response.data["timeSeries"]) == 0

    def test_interval_larger_than_period_uses_default_period(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(seconds=10),
                "interval": "15s",
                "query": "",
                "yAxis": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 400, response.content
        assert "Interval cannot be larger than the date range" in response.data["detail"]

    def test_cache_miss_rate(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "cache_miss_rate()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 1.0, 0.25], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "percentage",
            "valueUnit": None,
            "interval": 60_000,
        }

    def test_trace_status_rate(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "trace_status_rate(ok)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 0.5, 0.75], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "percentage",
            "valueUnit": None,
            "interval": 60_000,
        }

    def test_count_op(self) -> None:
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count_op(queue.publish)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 2.0, 1.0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
        }

    @pytest.mark.xfail(reason="https://github.com/getsentry/eap-planning/issues/237")
    def test_downsampling_single_series(self) -> None:
        span = self.create_span(
            {"description": "foo", "sentry_tags": {"status": "success"}},
            start_ts=self.day_ago + timedelta(minutes=1),
        )
        span["span_id"] = KNOWN_PREFLIGHT_ID
        span2 = self.create_span(
            {"description": "zoo", "sentry_tags": {"status": "success"}},
            start_ts=self.day_ago + timedelta(minutes=1),
        )
        span2["span_id"] = "b" * 16
        self.store_spans(
            [span, span2],
            is_eap=True,
        )
        self.end = self.start + timedelta(minutes=3)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "PREFLIGHT",
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 512, 0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
        }

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "BEST_EFFORT",
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
        }

    @pytest.mark.xfail(reason="https://github.com/getsentry/eap-planning/issues/237")
    def test_downsampling_top_events(self) -> None:
        span = self.create_span(
            {"description": "foo", "sentry_tags": {"status": "success"}},
            duration=100,
            start_ts=self.day_ago + timedelta(minutes=1),
        )
        span["span_id"] = KNOWN_PREFLIGHT_ID
        span2 = self.create_span(
            {"description": "zoo", "sentry_tags": {"status": "failure"}},
            duration=10,
            start_ts=self.day_ago + timedelta(minutes=1),
        )
        span2["span_id"] = "b" * 16
        self.store_spans(
            [span, span2],
            is_eap=True,
        )
        self.end = self.start + timedelta(minutes=3)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "groupBy": ["span.description", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "topEvents": 1,
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "PREFLIGHT",
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 512, 0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "isOther": False,
            "order": 0,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
        }

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                # update to span.description once https://github.com/getsentry/eap-planning/issues/237 is fixed
                "groupBy": ["span.status", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "topEvents": 1,
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "BEST_EFFORT",
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "isOther": False,
            "order": 0,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
        }

    def test_simple_equation(self) -> None:
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
                "yAxis": "equation|count() * 2",
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "equation|count() * 2"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 4.0, 2.0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
        }

    def test_equation_all_symbols(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process"},
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.process"},
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.publish"},
                    start_ts=self.start + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        equation = "equation|count() * 2 + 2 - 2 / 2"
        self.end = self.start + timedelta(minutes=3)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": equation,
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
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == equation
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 5.0, 3.0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
        }

    def test_simple_equation_with_multi_axis(self) -> None:
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
                "yAxis": ["equation|count() * 2", "equation|count() - 2"],
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
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "equation|count() * 2"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 4.0, 2.0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "equation|count() - 2"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 0.0, -1.0], ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
        }

    def test_simple_equation_with_top_events(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                    },
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "foo",
                    },
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "foo",
                    },
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "baz",
                    },
                    start_ts=self.start + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "bar",
                    },
                    start_ts=self.start + timedelta(minutes=2),
                ),
                self.create_span(
                    {
                        "description": "bar",
                    },
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
                "yAxis": "equation|count() * 2",
                "topEvents": 2,
                "groupBy": ["description", "equation|count() * 2"],
                "orderby": "-equation|count() * 2",
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
        assert len(response.data["timeSeries"]) == 3

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "equation|count() * 2"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 6.0, 0.0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "description", "value": "foo"},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "number",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "equation|count() * 2"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 0.0, 4.0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [
            {"key": "description", "value": "bar"},
        ]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": None,
            "valueType": "number",
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "equation|count() * 2"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0.0, 2.0, 0.0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] is None
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueUnit": None,
            "valueType": "number",
            "interval": 60_000,
            "isOther": True,
            "order": 2,
        }

    def test_disable_extrapolation(self) -> None:
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
                "disableAggregateExtrapolation": 1,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_counts, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    @mock.patch(
        "sentry.utils.snuba_rpc._make_rpc_requests",
        wraps=_make_rpc_requests,
    )
    def test_extrapolation_mode_server_only(self, mock_rpc_request) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "measurements": {"server_sample_rate": {"value": 0.1}},
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
                "extrapolationMode": "serverOnly",
            },
        )

        assert (
            mock_rpc_request.call_args.kwargs["timeseries_requests"][0]
            .expressions[0]
            .aggregation.extrapolation_mode
            == ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY
        )

        assert response.data["meta"] == {
            "dataset": "spans",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"

        # TODO: Ensure server only extrapolation actually gets applied
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_top_events_with_timestamp(self) -> None:
        """Users shouldn't groupby timestamp for top events"""
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count(span.self_time)",
                "groupBy": ["timestamp", "count(span.self_time)"],
                "query": "count(span.self_time):>4",
                "orderby": ["-count(span.self_time)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 5,
            },
        )
        assert response.status_code == 400, response.content
