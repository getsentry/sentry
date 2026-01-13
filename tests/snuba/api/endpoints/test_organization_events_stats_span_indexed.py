from datetime import timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse

from sentry.search.utils import DEVICE_CLASS
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba_rpc import SnubaRPCError
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase
from tests.snuba.api.endpoints.test_organization_events_span_indexed import KNOWN_PREFLIGHT_ID

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsStatsSpansEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"
        assert response.data["meta"]["fields"]["count()"] == "integer"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]

    def test_handle_nans_from_snuba(self) -> None:
        self.store_spans(
            [self.create_span({"description": "foo"}, start_ts=self.day_ago)],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "yAxis": "avg(measurements.lcp)",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
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
                    start_ts=self.day_ago,
                ),
                self.create_span({"description": "foo"}, start_ts=self.day_ago),
                self.create_span({"description": "foo"}, start_ts=self.two_days_ago),
                self.create_span(
                    {
                        "description": "bar",
                        "measurements": {"lcp": {"value": 2}},
                    },
                    start_ts=self.day_ago,
                ),
                self.create_span({"description": "bar"}, start_ts=self.day_ago),
                self.create_span({"description": "bar"}, start_ts=self.two_days_ago),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "field": ["span.description", "p50(measurements.lcp)", "avg(measurements.lcp)"],
                "yAxis": ["p50(measurements.lcp)", "avg(measurements.lcp)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 1,
                "partial": 1,
                "per_page": 50,
                "interval": "1d",
                "statsPeriod": "7d",
                "orderby": "-avg_measurements_lcp",
                "sort": "-avg_measurements_lcp",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content

        # We cannot actually assert the value because the `spans_indexed` is
        # producing the wrong result and treating missing values as 0s which
        # skews the final aggregation.
        # This is also the reason it never errored because snuba never returns
        # nans in this situation.
        #
        # for k in response.data:
        #     for agg in ["p50(measurements.lcp)", "avg(measurements.lcp)"]:
        #         for row in response.data[k][agg]["data"]:
        #             assert row[1][0]["count"] in {0, 1, 2}
        # assert response.data["Other"]

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count_unique(foo)",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"
        assert response.data["meta"]["fields"]["count_unique(foo)"] == "integer"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]

    def test_p95(self) -> None:
        event_durations = [6, 0, 6, 3, 0, 3]
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    duration=duration,
                    start_ts=self.day_ago + timedelta(hours=hour, minutes=1),
                )
                for hour, duration in enumerate(event_durations)
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "p95()",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"

        rows = data[0:6]
        for test in zip(event_durations, rows):
            assert test[1][1][0]["count"] == test[0]

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": ["count()", "p95()"],
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        count_data = response.data["count()"]["data"]
        p95_data = response.data["p95()"]["data"]
        assert len(count_data) == len(p95_data) == 6

        count_rows = count_data[0:6]
        for test in zip(event_counts, count_rows):
            assert test[1][1][0]["count"] == test[0]
        p95_rows = p95_data[0:6]
        for test in zip(event_counts, p95_rows):
            assert test[1][1][0]["count"] == test[0]
        assert response.data["count()"]["meta"]["fields"]["count()"] == "integer"
        assert response.data["p95()"]["meta"]["fields"]["p95()"] == "duration"

    # These throughput tests should roughly match the ones in OrganizationEventsStatsEndpointTest
    @pytest.mark.querybuilder
    def test_throughput_epm_hour_rollup(self) -> None:
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ]
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "epm()",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"

        rows = data[:6]
        for test in zip(event_counts, rows):
            self.assertAlmostEqual(test[1][1][0]["count"], test[0] / (3600.0 / 60.0))

    def test_throughput_epm_day_rollup(self) -> None:
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.two_days_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ]
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.two_days_ago,
                "end": self.day_ago,
                "interval": "24h",
                "yAxis": "epm()",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert response.data["meta"]["dataset"] == "spans"
        self.assertAlmostEqual(data[0][1][0]["count"], sum(event_counts) / (86400.0 / 60.0))

    def test_throughput_epm_hour_rollup_offset_of_hour(self) -> None:
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute + 30),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago + timedelta(minutes=30),
                "end": self.day_ago + timedelta(hours=6, minutes=30),
                "interval": "1h",
                "yAxis": "epm()",
                "project": self.project.id,
                "dataset": "spans",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 7
        assert meta["dataset"] == "spans"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            self.assertAlmostEqual(test[1][1][0]["count"], test[0] / (3600.0 / 60.0))

        assert meta["units"] == {"epm()": "1/minute"}
        assert meta["fields"] == {"epm()": "rate"}

    @pytest.mark.xfail(reason="epm not implemented yet")
    def test_throughput_eps_minute_rollup(self) -> None:
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        spans = []
        for minute, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.day_ago + timedelta(minutes=minute, seconds=second),
                    )
                    for second in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        for axis in ["eps()", "sps()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(minutes=6),
                    "interval": "1m",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": "spans",
                    "transformAliasToInputFormat": 1,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == "spans"

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_top_events(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "bar", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "baz", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "qux", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        assert "foo" in response.data
        assert "bar" in response.data
        assert len(response.data["Other"]["data"]) == 6

        for key in ["foo", "bar"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key

        rows = response.data["Other"]["data"][0:6]
        for expected, result in zip([0, 2, 0, 0, 0, 0], rows):
            assert result[1][0]["count"] == expected, "Other"

        assert response.data["Other"]["meta"]["dataset"] == "spans"

    def test_top_events_empty_other(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                )
                for transaction in ["foo", "bar"]
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" not in response.data
        assert "foo" in response.data
        assert "bar" in response.data
        for key in ["foo", "bar"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key
        assert response.data["foo"]["meta"]["dataset"] == "spans"

    def test_top_events_exclude_other(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000 if transaction in ["foo", "bar"] else 100,
                )
                for transaction in ["foo", "bar", "qux"]
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 1,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" not in response.data
        assert "foo" in response.data
        assert "bar" in response.data
        for key in ["foo", "bar"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key
            assert response.data[key]["meta"]["dataset"] == "spans"

    def test_top_events_multi_y_axis(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                )
                for transaction in ["foo", "bar", "baz"]
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
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

        for key in ["Other", "bar", "baz"]:
            assert key in response.data
            for y_axis in ["count()", "p50(span.duration)"]:
                assert y_axis in response.data[key]
                assert response.data[key][y_axis]["meta"]["dataset"] == "spans"
            counts = response.data[key]["count()"]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], counts):
                assert result[1][0]["count"] == expected, key
            p50s = response.data[key]["p50(span.duration)"]["data"][0:6]
            for expected, result in zip([0, 2000, 0, 0, 0, 0], p50s):
                assert result[1][0]["count"] == expected, key

    def test_top_events_with_project(self) -> None:
        projects = [self.create_project(), self.create_project()]
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    project=project,
                    duration=2000,
                )
                for project in projects
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"segment_name": "baz", "sentry_tags": {"status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        assert projects[0].slug in response.data
        assert projects[1].slug in response.data
        assert len(response.data["Other"]["data"]) == 6
        for key in ["Other", projects[0].slug, projects[1].slug]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key
        assert response.data["Other"]["meta"]["dataset"] == "spans"

    def test_top_events_with_project_and_project_id(self) -> None:
        projects = [self.create_project(), self.create_project()]
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    project=project,
                    duration=2000,
                )
                for project in projects
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"segment_name": "baz", "sentry_tags": {"status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        key1 = f"{projects[0].slug},{projects[0].id}"
        key2 = f"{projects[1].slug},{projects[1].id}"
        assert key1 in response.data
        assert key2 in response.data
        assert len(response.data["Other"]["data"]) == 6
        for key in ["Other", key1, key2]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key
        assert response.data["Other"]["meta"]["dataset"] == "spans"

    def test_top_events_with_no_data(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

    def test_count_unique_nans(self) -> None:
        self.store_span(
            self.create_span(start_ts=self.two_days_ago + timedelta(minutes=1)),
            is_eap=True,
        )
        response = self._do_request(
            data={
                "field": ["count_unique(foo)"],
                "yAxis": ["count_unique(foo)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 1,
                "partial": 1,
                "per_page": 50,
                "interval": "1d",
                "statsPeriod": "7d",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0] * 10

    def test_extrapolation_count(self) -> None:
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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"

        for expected, actual in zip(event_counts, data[0:6]):
            assert actual[1][0]["count"] == expected * 10

        accuracy = meta["accuracy"]
        confidence = accuracy["confidence"]
        sample_count = accuracy["sampleCount"]
        sample_rate = accuracy["samplingRate"]
        for expected, actual in zip(event_counts, confidence[0:6]):
            if expected != 0:
                assert actual["value"] == "low"
            else:
                assert actual["value"] is None

        # Check old confidence format, TODO: remove this once frontend is updated
        old_confidence = response.data["confidence"]
        for expected, actual in zip(event_counts, old_confidence[0:6]):
            if expected != 0:
                assert actual[1][0]["count()"] == "low"
            else:
                assert actual[1][0]["count()"] is None

        for expected, actual in zip(event_counts, sample_count[0:6]):
            assert actual["value"] == expected

        for expected, actual in zip(event_counts, sample_rate[0:6]):
            if expected != 0:
                assert actual["value"] == pytest.approx(0.1)
            else:
                assert actual["value"] is None

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
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
            # "p100(span.duration)",
            # "min(span.duration)",
            # "max(span.duration)",
        ]

        for y_axis in y_axes:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": y_axis,
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
            assert response.status_code == 200, (y_axis, response.content)
            data = response.data["data"]
            meta = response.data["meta"]

            assert len(data) == len(event_counts), y_axis
            for count, row in zip(event_counts, data):
                if count == 0:
                    assert row[1][0]["count"] == 0, y_axis
                else:
                    assert isinstance(row[1][0]["count"], (float, int)), y_axis

            accuracy = meta["accuracy"]
            confidence = accuracy["confidence"]
            sample_count = accuracy["sampleCount"]
            sample_rate = accuracy["samplingRate"]
            for expected, actual in zip(event_counts, confidence[0:6]):
                if expected != 0:
                    assert actual["value"] in ("high", "low")
                else:
                    assert actual["value"] is None

            old_confidence = response.data["confidence"]
            for expected, actual in zip(event_counts, old_confidence[0:6]):
                if expected != 0:
                    assert actual[1][0][y_axis] in ("high", "low")
                else:
                    assert actual[1][0][y_axis] is None

            for expected, actual in zip(event_counts, sample_count[0:6]):
                assert actual["value"] == expected

            for expected, actual in zip(event_counts, sample_rate[0:6]):
                if expected != 0:
                    assert actual["value"] == pytest.approx(0.1)
                else:
                    assert actual["value"] is None

    def test_extrapolation_with_multiaxis(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        p95_counts = [0, 0, 6, 3, 0, 0]
        spans = []
        for hour, count in enumerate(event_counts):
            measurements = {"client_sample_rate": {"value": 0.1}}
            if hour in [2, 3]:
                measurements["lcp"] = {"value": count}
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "measurements": measurements,
                        },
                        duration=count,
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": ["count()", "p95(measurements.lcp)"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        count_data = response.data["count()"]["data"]
        p95_data = response.data["p95(measurements.lcp)"]["data"]
        assert len(count_data) == len(p95_data) == 6

        count_rows = count_data[0:6]
        for test in zip(event_counts, count_rows):
            assert test[1][1][0]["count"] == test[0] * 10

        for column in ["count()", "p95(measurements.lcp)"]:
            if column == "p95(measurements.lcp)":
                counts = p95_counts
            else:
                counts = event_counts
            accuracy = response.data[column]["meta"]["accuracy"]
            confidence = accuracy["confidence"]
            sample_count = accuracy["sampleCount"]
            sample_rate = accuracy["samplingRate"]
            for expected, actual in zip(counts, confidence[0:6]):
                if expected != 0:
                    assert actual["value"] in ("high", "low")
                else:
                    assert actual["value"] is None

            old_confidence = response.data[column]["confidence"]
            for expected, actual in zip(counts, old_confidence[0:6]):
                if expected != 0:
                    assert actual[1][0]["count"] in ("high", "low")
                else:
                    assert actual[1][0]["count"] is None

            for expected, actual in zip(counts, sample_count[0:6]):
                assert actual["value"] == expected

            for expected, actual in zip(counts, sample_rate[0:6]):
                if expected != 0:
                    assert actual["value"] == pytest.approx(0.1)
                else:
                    assert actual["value"] is None

        p95_rows = p95_data[0:6]
        for test in zip(p95_counts, p95_rows):
            assert test[1][1][0]["count"] == test[0]

    def test_top_events_with_extrapolation(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "foo", "status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.1}},
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "bar", "status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.1}},
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {
                        "segment_name": "baz",
                        "sentry_tags": {"status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.1}},
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )
        event_counts = [0, 1, 0, 0, 0, 0]

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        assert "foo" in response.data
        assert "bar" in response.data
        assert len(response.data["Other"]["data"]) == 6
        for key in ["Other", "foo", "bar"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip(event_counts, rows):
                assert result[1][0]["count"] == expected * 10, key

            meta = response.data[key]["meta"]
            accuracy = meta["accuracy"]
            confidence = accuracy["confidence"]
            sample_count = accuracy["sampleCount"]
            sample_rate = accuracy["samplingRate"]
            for expected, actual in zip(event_counts, confidence[0:6]):
                if expected != 0:
                    assert actual["value"] == "low"
                else:
                    assert actual["value"] is None

            for expected, actual in zip(event_counts, sample_count[0:6]):
                assert actual["value"] == expected

            for expected, actual in zip(event_counts, sample_rate[0:6]):
                if expected != 0:
                    assert actual["value"] == pytest.approx(0.1)
                else:
                    assert actual["value"] is None
            assert response.data["Other"]["meta"]["dataset"] == "spans"

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
                                self.day_ago + timedelta(hours=hour, minutes=minute)
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
                "start": self.day_ago,
                "end": self.day_ago + timedelta(days=1),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 24
        assert response.data["meta"]["dataset"] == "spans"

        rows = data[0:6]
        for expected, actual in zip(event_counts, rows):
            assert actual[1][0]["count"] == expected
            assert actual[1][0]["comparisonCount"] == expected / 2

    def test_comparison_delta_with_empty_comparison_values(self) -> None:
        event_counts = [6, 0, 6, 4, 0, 4]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(days=1),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 24
        assert response.data["meta"]["dataset"] == "spans"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]
            assert test[1][1][0]["comparisonCount"] == 0

    def test_invalid_intervals(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "20s",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        for querystring in [f"project:{self.project.slug}", f"project:[{self.project.slug}]"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": "count()",
                    "query": querystring,
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == "spans"

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0]

    def test_nonexistent_project_filter(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
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
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": "count()",
                    "query": querystring,
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == "spans"

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0]

    def test_device_class_filter_empty(self):
        event_counts = [
            ("low", 1),
            ("", 2),
            ("low", 3),
            ("", 4),
            ("low", 5),
            ("", 6),
        ]
        spans = []
        for hour, [device_class, count] in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {
                                "status": "success",
                                **(
                                    {"device.class": list(DEVICE_CLASS["low"])[0]}
                                    if device_class == "low"
                                    else {}
                                ),
                            },
                        },
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "query": 'device.class:""',
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        for (device_class, count), row in zip(event_counts, response.data["data"]):
            test_count = count if device_class == "" else 0
            assert row[1][0]["count"] == test_count

    def test_device_class_top_events(self) -> None:
        event_counts = [
            ("low", 6),
            ("medium", 0),
            ("low", 6),
            ("medium", 6),
            ("low", 0),
            ("medium", 3),
        ]
        spans = []
        for hour, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {
                            "description": "foo",
                            "sentry_tags": {
                                "status": "success",
                                "device.class": (
                                    list(DEVICE_CLASS["low"])[0]
                                    if count[0] == "low"
                                    else list(DEVICE_CLASS["medium"])[0]
                                ),
                            },
                        },
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count[1])
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "field": ["device.class", "count()"],
                "topEvents": 5,
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        low = response.data["low"]["data"]
        assert len(low) == 6

        rows = low[0:6]
        for i, test in enumerate(zip(event_counts, rows)):
            test_data, row = test
            test_count = test_data[1] if test_data[0] == "low" else 0.0
            assert row[1][0]["count"] == test_count

        medium = response.data["medium"]["data"]
        assert len(medium) == 6

        rows = medium[0:6]
        for i, test in enumerate(zip(event_counts, rows)):
            test_data, row = test
            test_count = test_data[1] if test_data[0] == "medium" else 0.0
            assert row[1][0]["count"] == test_count

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
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count(span.self_time)",
                "field": ["transaction", "count(span.self_time)"],
                "query": "count(span.self_time):>4",
                "orderby": ["-count_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 5,
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

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

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "cache_miss_rate()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 1.0
        assert data[2][1][0]["count"] == 0.25
        assert response.data["meta"]["dataset"] == "spans"

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
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "unknown"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"sentry_tags": {"trace.status": "ok"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "trace_status_rate(ok)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 0.5
        assert data[2][1][0]["count"] == 0.75
        assert response.data["meta"]["dataset"] == "spans"

    def test_count_op(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count_op(queue.publish)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 2.0
        assert data[2][1][0]["count"] == 1.0
        assert response.data["meta"]["dataset"] == "spans"

    def test_top_events_with_escape_characters(self) -> None:
        key = "test\\n*"
        key2 = "test\\n\\*"
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {"transaction": key, "status": "success"},
                        "tags": {"foo": key},
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {
                        "sentry_tags": {"transaction": key, "status": "success"},
                        "tags": {"foo": key2},
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["foo", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        for response_key in [key, key2]:
            assert response_key in response.data
            assert len(response.data[response_key]["data"]) == 6, response_key
            rows = response.data[response_key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, response_key

    def test_time_spent_percentage_timeseries_fails(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "time_spent_percentage(span.self_time)",
                "project": self.project.id,
                "dataset": "spans",
            },
        )

        assert response.status_code == 400, response.content
        assert (
            "The Function Time_Spent_Percentage Is Not Allowed For This Query"
            in response.data["detail"].title()
        )

    def test_module_alias(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "op": "http.client",
                        "description": "GET /app/index",
                        "sentry_tags": {
                            "description": "GET /app/index",
                            "category": "http",
                            "op": "http.client",
                            "transaction": "my-transaction",
                        },
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "query": "span.module:http",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3
        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 1.0
        assert data[2][1][0]["count"] == 0.0
        assert response.data["meta"]["dataset"] == "spans"

    def test_module_alias_multi_value(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "op": "http.client",
                        "description": "GET /app/index",
                        "sentry_tags": {
                            "description": "GET /app/index",
                            "category": "http",
                            "op": "http.client",
                            "transaction": "my-transaction",
                        },
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "op": "cache.get",
                        "description": "get user cache",
                        "sentry_tags": {
                            "description": "get user cache",
                            "category": "cache",
                            "op": "cache.get",
                            "transaction": "my-transaction",
                        },
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "query": "span.module:[http,cache]",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3
        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 2.0
        assert data[2][1][0]["count"] == 0.0
        assert response.data["meta"]["dataset"] == "spans"

    def test_http_response_rate(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "description 1", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"description": "description 1", "sentry_tags": {"status_code": "400"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "400"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["http_response_rate(5)"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data

        assert data["data"][0][1][0]["count"] == 0.0
        assert data["data"][1][1][0]["count"] == 0.5
        assert data["data"][2][1][0]["count"] == 0.75

    def test_http_response_rate_multiple_series(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "description 1", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"description": "description 1", "sentry_tags": {"status_code": "400"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "500"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {"description": "description 2", "sentry_tags": {"status_code": "400"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["http_response_rate(4)", "http_response_rate(5)"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data

        assert data["http_response_rate(4)"]["data"][0][1][0]["count"] == 0.0
        assert data["http_response_rate(4)"]["data"][1][1][0]["count"] == 0.5
        assert data["http_response_rate(4)"]["data"][2][1][0]["count"] == 0.25

        assert data["http_response_rate(5)"]["data"][0][1][0]["count"] == 0.0
        assert data["http_response_rate(5)"]["data"][1][1][0]["count"] == 0.5
        assert data["http_response_rate(5)"]["data"][2][1][0]["count"] == 0.75

    @pytest.mark.xfail(reason="https://github.com/getsentry/snuba/pull/7067")
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
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "PREFLIGHT",
            },
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3
        assert data[0][1][0]["count"] == 0
        assert data[1][1][0]["count"] == 512  # The preflight table is 1/512 of the full table
        assert data[2][1][0]["count"] == 0
        assert response.data["meta"]["dataset"] == "spans"
        assert response.data["meta"]["dataScanned"] == "partial"

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "BEST_EFFORT",
            },
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3
        assert data[0][1][0]["count"] == 0
        assert data[1][1][0]["count"] == 2
        assert data[2][1][0]["count"] == 0
        assert response.data["meta"]["dataset"] == "spans"
        assert response.data["meta"]["dataScanned"] == "full"

    @pytest.mark.xfail(reason="https://github.com/getsentry/snuba/pull/7067")
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
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "field": ["span.description", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "topEvents": 1,
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "PREFLIGHT",
            },
        )

        assert "foo" in response.data
        assert "Other" not in response.data

        rows = response.data["foo"]["data"][0:6]
        for expected, result in zip([0, 512, 0], rows):
            assert result[1][0]["count"] == expected

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "field": ["span.description", "sum(span.self_time)"],
                "orderby": ["-sum(span.self_time)"],
                "topEvents": 1,
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "BEST_EFFORT",
            },
        )

        assert "foo" in response.data
        assert "Other" in response.data

        rows = response.data["foo"]["data"][0:6]
        for expected, result in zip([0, 1, 0], rows):
            assert result[1][0]["count"] == expected

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
        assert "for periods of at least" in response.data["detail"]

    def test_small_valid_timerange(self) -> None:
        # Each of these denotes how many events to create in each bucket
        event_counts = [6, 3]
        spans = []
        for offset, count in enumerate(event_counts):
            spans.extend(
                [
                    self.create_span(
                        {"description": "foo", "sentry_tags": {"status": "success"}},
                        start_ts=self.day_ago + timedelta(seconds=offset * 15 + 1),
                    )
                    for _ in range(count)
                ]
            )
        self.store_spans(spans, is_eap=True)
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(seconds=30),
                "interval": "15s",
                "query": "",
                "yAxis": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        count_rows = response.data["data"]
        for test in zip(event_counts, count_rows):
            assert test[1][1][0]["count"] == test[0]

    @pytest.mark.xfail(
        reason="https://github.com/getsentry/snuba/actions/runs/14717943981/job/41305773190"
    )
    def test_downsampling_can_go_to_higher_accuracy_tier(self) -> None:
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
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "NORMAL",
            },
        )

        assert response.data["meta"]["dataScanned"] == "full"

        # Use preflight to test that we can go to a higher accuracy tier
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "PREFLIGHT",
            },
        )

        assert response.data["meta"]["dataScanned"] == "partial"

    def test_request_without_sampling_mode_defaults_to_highest_accuracy(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )

        assert response.data["meta"]["dataScanned"] == "full"

    def test_request_to_highest_accuracy_mode(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "sampling": "HIGHEST_ACCURACY",
            },
        )

        assert response.data["meta"]["dataScanned"] == "full"

    def test_top_n_is_transaction(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"is_segment": True},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"is_segment": False},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "field": ["is_transaction", "count(span.duration)"],
                "yAxis": ["count(span.duration)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 1,
                "topEvents": 2,
                "partial": 1,
                "per_page": 50,
                "interval": "1d",
                "statsPeriod": "7d",
                "orderby": "-count_span_duration",
                "sort": "-count_span_duration",
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        assert set(response.data.keys()) == {"True", "False"}

    def test_datetime_unaligned_with_regular_buckets(self) -> None:
        """When querying from 10:12-22:12 with 1 hour intervals
        the returned buckets should be every hour; ie 10am, 11am, 12pm
        but the data should still be constrained from 22:12-22:12"""
        spans = []
        # Create a span at 10:05, this should not be in the result
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.day_ago + timedelta(minutes=5),
            )
        )
        # Create a span at 10:30, this should be in the result
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.day_ago + timedelta(minutes=30),
            )
        )
        # Create a span at 22:05, this should be in the result
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.day_ago + timedelta(hours=12, minutes=5),
            )
        )
        self.store_spans(spans, is_eap=True)

        # This should be set to 10:00 the previous day
        query_start = self.day_ago + timedelta(minutes=12)
        query_end = self.day_ago + timedelta(hours=12, minutes=12)
        response = self._do_request(
            data={
                "start": query_start,
                "end": query_end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 13
        assert response.data["meta"]["dataset"] == "spans"
        # The timestamp of the first event should be 10:00, and there should only be 1 event
        assert data[0] == (self.day_ago.timestamp(), [{"count": 1}])
        # The timestamp of the last event should be 22:00 and there should also only be 1 event
        assert data[-1] == ((self.day_ago + timedelta(hours=12)).timestamp(), [{"count": 1}])

    def test_top_events_with_timestamp(self) -> None:
        """Users shouldn't groupby timestamp for top events"""
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["timestamp", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 400, response.content

    def test_simple_equation(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "equation|count() * 2",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 4.0
        assert data[2][1][0]["count"] == 2.0
        assert response.data["meta"]["dataset"] == "spans"

    def test_equation_all_symbols(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        equation = "equation|count() * 2 + 2 - 2 / 2"
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": equation,
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 5.0
        assert data[2][1][0]["count"] == 3.0
        assert response.data["meta"]["dataset"] == "spans"

    def test_simple_equation_with_multi_axis(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": ["equation|count() * 2", "equation|count() - 2"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["equation|count() * 2"]["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 4.0
        assert data[2][1][0]["count"] == 2.0

        data = response.data["equation|count() - 2"]["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 0.0
        assert data[2][1][0]["count"] == -1.0

    def test_simple_equation_with_top_events(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "foo",
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "baz",
                    },
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
                self.create_span(
                    {
                        "description": "bar",
                    },
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
                self.create_span(
                    {
                        "description": "bar",
                    },
                    start_ts=self.day_ago + timedelta(minutes=2),
                ),
            ],
            is_eap=True,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=3),
                "interval": "1m",
                "yAxis": "equation|count() * 2",
                "topEvents": 2,
                "field": ["description", "equation|count() * 2"],
                "orderby": "-equation|count() * 2",
                "project": self.project.id,
                "dataset": "spans",
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["foo"]["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 4.0
        assert data[2][1][0]["count"] == 0.0

        data = response.data["bar"]["data"]
        assert len(data) == 3

        assert data[0][1][0]["count"] == 0.0
        assert data[1][1][0]["count"] == 0.0
        assert data[2][1][0]["count"] == 4.0

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=True)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "disableAggregateExtrapolation": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == "spans"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]

    def test_debug_param(self) -> None:
        self.user = self.create_user("user@example.com", is_superuser=False)
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(user=self.user)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
                "debug": True,
            },
        )

        assert response.status_code == 200, response.content
        # Debug should be ignored without superuser
        assert "debug_info" not in response.data["meta"]

        self.user = self.create_user("superuser@example.com", is_superuser=True)
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(user=self.user)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
                "debug": True,
            },
        )

        assert response.status_code == 200, response.content
        assert "debug_info" in response.data["meta"]

        assert (
            "FUNCTION_COUNT"
            == response.data["meta"]["debug_info"]["query"]["expressions"][0]["aggregation"][
                "aggregate"
            ]
        )

    def test_debug_with_top_events(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "bar", "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                ),
            ],
            is_eap=True,
        )

        self.user = self.create_user("superuser@example.com", is_superuser=True)
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(user=self.user)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["count()"],
                "field": ["transaction"],
                "project": self.project.id,
                "dataset": "spans",
                "topEvents": 2,
                "debug": True,
            },
        )

        assert response.status_code == 200, response.content

        assert (
            "FUNCTION_COUNT"
            == response.data["bar"]["meta"]["debug_info"]["query"]["expressions"][0]["aggregation"][
                "aggregate"
            ]
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["count()"],
                "field": ["transaction"],
                "project": self.project.id,
                "dataset": "spans",
                "topEvents": 2,
            },
        )

        assert response.status_code == 200, response.content
        assert "debug_info" not in response.data["bar"]["meta"]

    @patch("sentry.utils.snuba_rpc.timeseries_rpc")
    def test_debug_param_with_error(self, mock_query) -> None:
        self.user = self.create_user("superuser@example.com", is_superuser=True)
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(user=self.user)
        mock_query.side_effect = SnubaRPCError("test")

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
                "debug": True,
            },
        )

        assert response.status_code == 500, response.content
        assert response.data["detail"] == "Internal error. Please try again."
        assert "meta" in response.data
        assert "debug_info" in response.data["meta"]

        assert (
            "FUNCTION_COUNT"
            == response.data["meta"]["debug_info"]["query"]["expressions"][0]["aggregation"][
                "aggregate"
            ]
        )

        # Need to reset the mock, otherwise previous query is still attached
        mock_query.side_effect = SnubaRPCError("test")

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=4),
                "interval": "1m",
                "query": "",
                "yAxis": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
            },
        )

        assert response.status_code == 500, response.content
        assert response.data["detail"] == "Internal error. Please try again."
        assert "meta" not in response.data
        assert "debug_info" not in response.data

    def test_groupby_non_existent_attribute(self):
        self.store_spans(
            [
                self.create_span({"description": "span"}, start_ts=self.day_ago),
                self.create_span({"description": "span"}, start_ts=self.day_ago),
                self.create_span(
                    {
                        "description": "span",
                        "tags": {"foo": "foo"},
                        "measurements": {"bar": {"value": 1}},
                    },
                    start_ts=self.day_ago,
                ),
            ],
            is_eap=True,
        )
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count(span.duration)",
                "field": ["foo", "tags[bar,number]", "count(span.duration)"],
                "orderby": ["-count(span.duration)"],
                "project": self.project.id,
                "dataset": "spans",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        count_none = sum(entry[1][0]["count"] for entry in response.data["None,None"]["data"])
        assert count_none == 2

        count_foo_1 = sum(entry[1][0]["count"] for entry in response.data["foo,1.0"]["data"])
        assert count_foo_1 == 1

    def test_top_events_with_aggregate_functions_in_field(self) -> None:
        """Test that topEvents works when aggregate functions are passed in the field parameter.
        
        This test specifically validates the fix for SnubaRPCError code 400:
        "Column is not one of: aggregate, attribute key, or formula"
        
        The issue occurred because aggregate functions in the 'field' parameter
        were incorrectly included in raw_groupby, causing malformed Snuba queries.
        """
        # Create spans with different transactions and statuses
        self.store_spans(
            [
                # Transaction "foo" - 3 spans total, 1 failed
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "ok"}},
                    start_ts=self.day_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "ok"}},
                    start_ts=self.day_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "foo", "status": "internal_error"}},
                    start_ts=self.day_ago,
                ),
                # Transaction "bar" - 2 spans total, 1 failed
                self.create_span(
                    {"sentry_tags": {"transaction": "bar", "status": "ok"}},
                    start_ts=self.day_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "bar", "status": "internal_error"}},
                    start_ts=self.day_ago,
                ),
            ],
            is_eap=True,
        )

        # This query should not fail with SnubaRPCError code 400
        # The field parameter includes aggregate functions that should be filtered out
        # from raw_groupby and only used in yAxis
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=1),
                "interval": "1h",
                "yAxis": ["count(span.duration)", "failure_rate()", "failure_count()"],
                "field": [
                    "transaction",
                    "tags[http.response.status_code,number]",
                    "count(span.duration)",
                    "failure_rate()",
                    "failure_count()",
                ],
                "query": "failure_rate():>0.1",
                "orderby": ["-count(span.duration)"],
                "project": self.project.id,
                "dataset": "spans",
                "topEvents": 5,
                "transformAliasToInputFormat": 1,
            },
        )
        
        # The request should succeed (not return 400)
        assert response.status_code == 200, response.content
        
        # Verify that we got results for the transactions
        assert "foo" in response.data or "foo,None" in response.data
        assert response.data  # Should have some data
