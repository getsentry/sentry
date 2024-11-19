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
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_spans(
                    [
                        self.create_span(
                            {"description": "foo", "sentry_tags": {"status": "success"}},
                            start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                        ),
                    ],
                    is_eap=self.is_eap,
                )

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
            assert test[1][1][0]["count"] == test[0]

    # These throughput tests should roughly match the ones in OrganizationEventsStatsEndpointTest
    @pytest.mark.querybuilder
    def test_throughput_epm_hour_rollup(self):
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_spans(
                    [
                        self.create_span(
                            {"description": "foo", "sentry_tags": {"status": "success"}},
                            start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                        ),
                    ],
                    is_eap=self.is_eap,
                )

        for axis in ["epm()", "spm()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": axis,
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
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_epm_day_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_spans(
                    [
                        self.create_span(
                            {"description": "foo", "sentry_tags": {"status": "success"}},
                            start_ts=self.day_ago + timedelta(hours=hour, minutes=minute),
                        ),
                    ],
                    is_eap=self.is_eap,
                )

        for axis in ["epm()", "spm()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=24),
                    "interval": "24h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "dataset": self.dataset,
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
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_spans(
                    [
                        self.create_span(
                            {"description": "foo", "sentry_tags": {"status": "success"}},
                            start_ts=self.day_ago + timedelta(hours=hour, minutes=minute + 30),
                        ),
                    ],
                    is_eap=self.is_eap,
                )

        for axis in ["epm()", "spm()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago + timedelta(minutes=30),
                    "end": self.day_ago + timedelta(hours=6, minutes=30),
                    "interval": "1h",
                    "yAxis": axis,
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
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_spans(
                    [
                        self.create_span(
                            {"description": "foo", "sentry_tags": {"status": "success"}},
                            start_ts=self.day_ago + timedelta(minutes=minute, seconds=second),
                        ),
                    ],
                    is_eap=self.is_eap,
                )

        for axis in ["eps()", "sps()"]:
            response = self._do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(minutes=6),
                    "interval": "1m",
                    "yAxis": axis,
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
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_top_events(self):
        # Each of these denotes how many events to create in each minute
        for transaction in ["foo", "bar"]:
            self.store_spans(
                [
                    self.create_span(
                        {"sentry_tags": {"transaction": transaction, "status": "success"}},
                        start_ts=self.day_ago + timedelta(minutes=1),
                        duration=2000,
                    ),
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
        assert response.data["Other"]["meta"]["dataset"] == self.dataset


class OrganizationEventsEAPSpanEndpointTest(OrganizationEventsStatsSpansMetricsEndpointTest):
    is_eap = True


class OrganizationEventsEAPRPCSpanEndpointTest(OrganizationEventsEAPSpanEndpointTest):
    is_eap = True
    is_rpc = True

    def test_count(self):
        super().test_count()

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

    @pytest.mark.xfail(reason="wip: not implemented yet")
    def test_top_events(self):
        super().test_top_events()
