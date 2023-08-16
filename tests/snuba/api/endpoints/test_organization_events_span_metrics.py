import pytest
from django.urls import reverse

from sentry.search.events import constants
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsMetricsEnhancedPerformanceEndpointTest(MetricsEnhancedPerformanceTestCase):
    viewname = "sentry-api-0-organization-events"

    # Poor intentionally omitted for test_measurement_rating_that_does_not_exist
    METRIC_STRINGS = [
        "foo_transaction",
        "bar_transaction",
    ]

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.six_min_ago = before_now(minutes=6)
        self.three_days_ago = before_now(days=3)
        self.features = {
            "organizations:starfish-view": True,
        }

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            self.viewname,
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_p50_with_no_data(self):
        response = self.do_request(
            {
                "field": ["p50()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["p50()"] == 0
        assert meta["dataset"] == "spansMetrics"

    def test_count(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.three_days_ago,
        )
        response = self.do_request(
            {
                "field": ["count()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "7d",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["count()"] == 1
        assert meta["dataset"] == "spansMetrics"

    def test_count_unique(self):
        self.store_span_metric(
            1,
            "user",
            timestamp=self.min_ago,
        )
        self.store_span_metric(
            2,
            "user",
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["count_unique(user)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["count_unique(user)"] == 2
        assert meta["dataset"] == "spansMetrics"

    def test_sum(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
        )
        self.store_span_metric(
            99,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["sum(span.self_time)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(span.self_time)"] == 420
        assert meta["dataset"] == "spansMetrics"

    def test_percentile(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["percentile(span.self_time, 0.95)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["percentile(span.self_time, 0.95)"] == 1
        assert meta["dataset"] == "spansMetrics"

    def test_fixed_percentile_functions(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
        )
        for function in ["p50()", "p75()", "p95()", "p99()", "p100()"]:
            response = self.do_request(
                {
                    "field": [function],
                    "query": "",
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                }
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            meta = response.data["meta"]
            assert len(data) == 1
            assert data[0][function] == 1, function
            assert meta["dataset"] == "spansMetrics", function
            assert meta["fields"][function] == "duration", function

    def test_fixed_percentile_functions_with_duration(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SPAN_METRICS_MAP["span.duration"],
            timestamp=self.min_ago,
        )
        for function in [
            "p50(span.duration)",
            "p75(span.duration)",
            "p95(span.duration)",
            "p99(span.duration)",
            "p100(span.duration)",
        ]:
            response = self.do_request(
                {
                    "field": [function],
                    "query": "",
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                }
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            meta = response.data["meta"]
            assert len(data) == 1, function
            assert data[0][function] == 1, function
            assert meta["dataset"] == "spansMetrics", function
            assert meta["fields"][function] == "duration", function

    def test_avg(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["avg()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["avg()"] == 1
        assert meta["dataset"] == "spansMetrics"

    def test_eps(self):
        for _ in range(6):
            self.store_span_metric(
                1,
                internal_metric=constants.SELF_TIME_LIGHT,
                timestamp=self.min_ago,
            )
        response = self.do_request(
            {
                "field": ["eps()", "sps()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["eps()"] == 0.01
        assert data[0]["sps()"] == 0.01
        assert meta["fields"]["eps()"] == "rate"
        assert meta["fields"]["sps()"] == "rate"
        assert meta["units"]["eps()"] == "1/second"
        assert meta["units"]["sps()"] == "1/second"
        assert meta["dataset"] == "spansMetrics"

    def test_epm(self):
        for _ in range(6):
            self.store_span_metric(
                1,
                internal_metric=constants.SELF_TIME_LIGHT,
                timestamp=self.min_ago,
            )
        response = self.do_request(
            {
                "field": ["epm()", "spm()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["epm()"] == 0.6
        assert data[0]["spm()"] == 0.6
        assert meta["fields"]["epm()"] == "rate"
        assert meta["fields"]["spm()"] == "rate"
        assert meta["units"]["epm()"] == "1/minute"
        assert meta["units"]["spm()"] == "1/minute"
        assert meta["dataset"] == "spansMetrics"

    def test_time_spent_percentage(self):
        for _ in range(4):
            self.store_span_metric(
                1,
                internal_metric=constants.SELF_TIME_LIGHT,
                tags={"transaction": "foo_transaction"},
                timestamp=self.min_ago,
            )
            self.store_span_metric(
                1,
                tags={"transaction": "foo_transaction"},
                timestamp=self.min_ago,
            )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        self.store_span_metric(
            1,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["transaction", "time_spent_percentage()"],
                "query": "",
                "orderby": ["-time_spent_percentage()"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["time_spent_percentage()"] == 0.8
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["time_spent_percentage()"] == 0.2
        assert data[1]["transaction"] == "bar_transaction"
        assert meta["dataset"] == "spansMetrics"

    def test_time_spent_percentage_local(self):
        response = self.do_request(
            {
                "field": ["time_spent_percentage(local)"],
                "query": "",
                "orderby": ["-time_spent_percentage(local)"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["time_spent_percentage(local)"] is None
        assert meta["dataset"] == "spansMetrics"

    def test_http_error_rate_and_count(self):
        for _ in range(4):
            self.store_span_metric(
                1,
                internal_metric=constants.SELF_TIME_LIGHT,
                tags={"span.status_code": "500"},
                timestamp=self.min_ago,
            )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={"span.status_code": "200"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["http_error_count()", "http_error_rate()"],
                "query": "",
                "orderby": ["-http_error_rate()"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["http_error_rate()"] == 0.8
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["http_error_count()"] == "integer"
        assert meta["fields"]["http_error_rate()"] == "percentage"

    def test_use_self_time_light(self):
        self.store_span_metric(
            100,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["p50(span.self_time)"],
                # Should be 0 since its filtering on transaction
                "query": "transaction:foo_transaction",
                "orderby": ["-p50(span.self_time)"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["p50(span.self_time)"] == 0
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["p50(span.self_time)"] == "duration"

        response = self.do_request(
            {
                # Should be 0 since it has a transaction column
                "field": ["transaction", "p50(span.self_time)"],
                "query": "",
                "orderby": ["-p50(span.self_time)"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 0

        response = self.do_request(
            {
                "field": ["p50(span.self_time)"],
                # Should be 100 since its not filtering on transaction
                "query": "",
                "orderby": ["-p50(span.self_time)"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["p50(span.self_time)"] == 100
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["p50(span.self_time)"] == "duration"

    def test_span_module(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "http"},
        )
        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "db"},
        )
        self.store_span_metric(
            5,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "foobar"},
        )
        self.store_span_metric(
            7,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "cache"},
        )
        response = self.do_request(
            {
                "field": ["span.module", "p50(span.self_time)"],
                "query": "",
                "orderby": ["-p50(span.self_time)"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 4
        assert data[0]["p50(span.self_time)"] == 7
        assert data[0]["span.module"] == "cache"
        assert data[1]["p50(span.self_time)"] == 5
        assert data[1]["span.module"] == "other"
        assert data[2]["p50(span.self_time)"] == 3
        assert data[2]["span.module"] == "db"
        assert data[3]["p50(span.self_time)"] == 1
        assert data[3]["span.module"] == "http"
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["p50(span.self_time)"] == "duration"

    def test_tag_search(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.description": "foo"},
        )
        self.store_span_metric(
            99,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.description": "bar"},
        )
        response = self.do_request(
            {
                "field": ["sum(span.self_time)"],
                "query": "span.description:bar",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(span.self_time)"] == 99
        assert meta["dataset"] == "spansMetrics"

    def test_free_text_search(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.description": "foo"},
        )
        self.store_span_metric(
            99,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.description": "bar"},
        )
        response = self.do_request(
            {
                "field": ["sum(span.self_time)"],
                "query": "foo",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(span.self_time)"] == 321
        assert meta["dataset"] == "spansMetrics"


@region_silo_test
class OrganizationEventsMetricsEnhancedPerformanceEndpointTestWithMetricLayer(
    OrganizationEventsMetricsEnhancedPerformanceEndpointTest
):
    def setUp(self):
        super().setUp()
        self.features["organizations:use-metrics-layer"] = True

    @pytest.mark.xfail(reason="Not implemented")
    def test_time_spent_percentage(self):
        super().test_time_spent_percentage()

    @pytest.mark.xfail(reason="Not implemented")
    def test_time_spent_percentage_local(self):
        super().test_time_spent_percentage_local()

    @pytest.mark.xfail(reason="Not implemented")
    def test_http_error_rate_and_count(self):
        super().test_http_error_rate_and_count()

    @pytest.mark.xfail(reason="Cannot group by transform")
    def test_span_module(self):
        super().test_span_module()

    @pytest.mark.xfail(reason="Cannot search by tags")
    def test_tag_search(self):
        super().test_tag_search()

    @pytest.mark.xfail(reason="Cannot search by tags")
    def test_free_text_search(self):
        super().test_free_text_search()
