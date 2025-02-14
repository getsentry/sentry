from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsStatsSpansMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-stats"
    is_eap = False
    is_rpc = False

    @property
    def dataset(self):
        if self.is_eap:
            return "spans"
        else:
            return "spansIndexed"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.two_days_ago = self.day_ago - timedelta(days=1)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        if self.is_rpc:
            data["useRpc"] = "1"
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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == self.dataset
        assert response.data["meta"]["fields"]["count()"] == "integer"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]

    def test_handle_nans_from_snuba(self):
        self.store_spans(
            [self.create_span({"description": "foo"}, start_ts=self.day_ago)],
            is_eap=self.is_eap,
        )

        response = self._do_request(
            data={
                "yAxis": "avg(measurements.lcp)",
                "project": self.project.id,
                "dataset": self.dataset,
                "transformAliasToInputFormat": 1,
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
            is_eap=self.is_eap,
        )

        response = self._do_request(
            data={
                "field": ["span.description", "p50(measurements.lcp)", "avg(measurements.lcp)"],
                "yAxis": ["p50(measurements.lcp)", "avg(measurements.lcp)"],
                "project": self.project.id,
                "dataset": self.dataset,
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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count_unique(foo)",
                "project": self.project.id,
                "dataset": self.dataset,
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == self.dataset
        assert response.data["meta"]["fields"]["count_unique(foo)"] == "integer"

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]

    def test_p95(self):
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
            is_eap=self.is_eap,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "p95()",
                "project": self.project.id,
                "dataset": self.dataset,
                "transformAliasToInputFormat": 1,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == self.dataset

        rows = data[0:6]
        for test in zip(event_durations, rows):
            assert test[1][1][0]["count"] == test[0]

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": ["count()", "p95()"],
                "project": self.project.id,
                "dataset": self.dataset,
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
    def test_throughput_epm_hour_rollup(self):
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
        self.store_spans(spans, is_eap=self.is_eap)

        for axis in ["epm()", "spm()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": self.dataset,
                    "transformAliasToInputFormat": 1,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == self.dataset

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_epm_day_rollup(self):
        # Each of these denotes how many events to create in each minute
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
        self.store_spans(spans, is_eap=self.is_eap)

        for axis in ["epm()", "spm()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=24),
                    "interval": "24h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": self.dataset,
                    "transformAliasToInputFormat": 1,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2
            assert response.data["meta"]["dataset"] == self.dataset

            assert data[0][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_epm_hour_rollup_offset_of_hour(self):
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
        self.store_spans(spans, is_eap=self.is_eap)

        for axis in ["epm()", "spm()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago + timedelta(minutes=30),
                    "end": self.day_ago + timedelta(hours=6, minutes=30),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": self.dataset,
                    "transformAliasToInputFormat": 1,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == self.dataset

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
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
        self.store_spans(spans, is_eap=self.is_eap)

        for axis in ["eps()", "sps()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(minutes=6),
                    "interval": "1m",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": self.dataset,
                    "transformAliasToInputFormat": 1,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == self.dataset

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_top_events(self):
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
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
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

        assert response.data["Other"]["meta"]["dataset"] == self.dataset

    def test_top_events_empty_other(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                )
                for transaction in ["foo", "bar"]
            ],
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
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
        assert response.data["foo"]["meta"]["dataset"] == self.dataset

    def test_top_events_multi_y_axis(self):
        # Each of these denotes how many events to create in each minute
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": transaction, "status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                    duration=2000,
                )
                for transaction in ["foo", "bar", "baz"]
            ],
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        for key in ["Other", "bar", "baz"]:
            assert key in response.data
            for y_axis in ["count()", "p50(span.duration)"]:
                assert y_axis in response.data[key]
                assert response.data[key][y_axis]["meta"]["dataset"] == self.dataset
            counts = response.data[key]["count()"]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], counts):
                assert result[1][0]["count"] == expected, key
            p50s = response.data[key]["p50(span.duration)"]["data"][0:6]
            for expected, result in zip([0, 2000, 0, 0, 0, 0], p50s):
                assert result[1][0]["count"] == expected, key

    def test_top_events_with_project(self):
        # Each of these denotes how many events to create in each minute
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
            is_eap=self.is_eap,
        )
        self.store_spans(
            [
                self.create_span(
                    {"segment_name": "baz", "sentry_tags": {"status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=self.is_eap,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "dataset": self.dataset,
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
        assert response.data["Other"]["meta"]["dataset"] == self.dataset

    def test_top_events_with_project_and_project_id(self):
        # Each of these denotes how many events to create in each minute
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
            is_eap=self.is_eap,
        )
        self.store_spans(
            [
                self.create_span(
                    {"segment_name": "baz", "sentry_tags": {"status": "success"}},
                    start_ts=self.day_ago + timedelta(minutes=1),
                ),
            ],
            is_eap=self.is_eap,
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "dataset": self.dataset,
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
        assert response.data["Other"]["meta"]["dataset"] == self.dataset

    def test_top_events_with_no_data(self):
        # Each of these denotes how many events to create in each minute
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "dataset": self.dataset,
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content


class OrganizationEventsEAPSpanEndpointTest(OrganizationEventsStatsSpansMetricsEndpointTest):
    is_eap = True

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == self.dataset

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0] * 10


class OrganizationEventsEAPRPCSpanEndpointTest(OrganizationEventsEAPSpanEndpointTest):
    is_eap = True
    is_rpc = True

    def test_extrapolation_count(self):
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
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 6
        assert response.data["meta"]["dataset"] == self.dataset

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=self.is_eap)

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
                    "dataset": self.dataset,
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
                    assert actual["value"] == "low"
                else:
                    assert actual["value"] is None

            old_confidence = response.data["confidence"]
            for expected, actual in zip(event_counts, old_confidence[0:6]):
                if expected != 0:
                    assert actual[1][0][y_axis] == "low"
                else:
                    assert actual[1][0][y_axis] is None

            for expected, actual in zip(event_counts, sample_count[0:6]):
                assert actual["value"] == expected

            for expected, actual in zip(event_counts, sample_rate[0:6]):
                if expected != 0:
                    assert actual["value"] == pytest.approx(0.1)
                else:
                    assert actual["value"] is None

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
                        start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": ["count()", "p95()"],
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        count_data = response.data["count()"]["data"]
        p95_data = response.data["p95()"]["data"]
        assert len(count_data) == len(p95_data) == 6

        count_rows = count_data[0:6]
        for test in zip(event_counts, count_rows):
            assert test[1][1][0]["count"] == test[0] * 10

        for column in ["count()", "p95()"]:
            accuracy = response.data[column]["meta"]["accuracy"]
            confidence = accuracy["confidence"]
            sample_count = accuracy["sampleCount"]
            sample_rate = accuracy["samplingRate"]
            for expected, actual in zip(event_counts, confidence[0:6]):
                if expected != 0:
                    assert actual["value"] == "low"
                else:
                    assert actual["value"] is None

            old_confidence = response.data[column]["confidence"]
            for expected, actual in zip(event_counts, old_confidence[0:6]):
                if expected != 0:
                    assert actual[1][0]["count"] == "low"
                else:
                    assert actual[1][0]["count"] is None

            for expected, actual in zip(event_counts, sample_count[0:6]):
                assert actual["value"] == expected

            for expected, actual in zip(event_counts, sample_rate[0:6]):
                if expected != 0:
                    assert actual["value"] == pytest.approx(0.1)
                else:
                    assert actual["value"] is None

        p95_rows = p95_data[0:6]
        for test in zip(event_counts, p95_rows):
            assert test[1][1][0]["count"] == test[0]

    def test_top_events_with_extrapolation(self):
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
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
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
            assert response.data["Other"]["meta"]["dataset"] == self.dataset

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
                                self.day_ago + timedelta(hours=hour, minutes=minute)
                                if current_period
                                else self.two_days_ago + timedelta(hours=hour, minutes=minute)
                            ),
                        )
                        for minute in range(count)
                    ],
                )
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(days=1),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
                "comparisonDelta": 24 * 60 * 60,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 24
        assert response.data["meta"]["dataset"] == self.dataset

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]
            assert test[1][1][0]["comparisonCount"] == test[0] / 2

    def test_comparison_delta_with_empty_comparison_values(self):
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
        self.store_spans(spans, is_eap=self.is_eap)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(days=1),
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
                "comparisonDelta": 24 * 60 * 60,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 24
        assert response.data["meta"]["dataset"] == self.dataset

        rows = data[0:6]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0]
            assert test[1][1][0]["comparisonCount"] == 0

    @pytest.mark.xfail(reason="epm not implemented yet")
    def test_throughput_epm_hour_rollup(self):
        super().test_throughput_epm_hour_rollup()

    @pytest.mark.xfail(reason="epm not implemented yet")
    def test_throughput_epm_day_rollup(self):
        super().test_throughput_epm_day_rollup()

    @pytest.mark.xfail(reason="epm not implemented yet")
    def test_throughput_epm_hour_rollup_offset_of_hour(self):
        super().test_throughput_epm_hour_rollup_offset_of_hour()

    @pytest.mark.xfail(reason="epm not implemented yet")
    def test_throughput_eps_minute_rollup(self):
        super().test_throughput_eps_minute_rollup()

    def test_invalid_intervals(self):
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["transaction", "sum(span.self_time)"],
                "orderby": ["-sum_span_self_time"],
                "project": self.project.id,
                "dataset": self.dataset,
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
                "dataset": self.dataset,
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 400, response.content

    @pytest.mark.xfail(reason="division by 0 error in snuba")
    def test_handle_nans_from_snuba_top_n(self):
        super().test_handle_nans_from_snuba_top_n()

    def test_project_filters(self):
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
        self.store_spans(spans, is_eap=self.is_eap)

        for querystring in [f"project:{self.project.slug}", f"project:[{self.project.slug}]"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": "count()",
                    "query": querystring,
                    "project": self.project.id,
                    "dataset": self.dataset,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == self.dataset

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0]

    def test_nonexistent_project_filter(self):
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "query": "project:foobar",
                "project": self.project.id,
                "dataset": self.dataset,
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
        self.store_spans(spans, is_eap=self.is_eap)

        for querystring in ["device.class:low", "device.class:[low,medium]"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": "count()",
                    "query": querystring,
                    "project": self.project.id,
                    "dataset": self.dataset,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["meta"]["dataset"] == self.dataset

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0]
