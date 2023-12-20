import pytest
from django.urls import reverse

from sentry.search.events import constants
from sentry.search.utils import map_device_class_level
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

    def test_ttid_rate_and_count(self):
        for _ in range(8):
            self.store_span_metric(
                1,
                internal_metric=constants.SELF_TIME_LIGHT,
                tags={"ttid": "ttid", "ttfd": "ttfd"},
                timestamp=self.min_ago,
            )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={"ttfd": "ttfd", "ttid": ""},
            timestamp=self.min_ago,
        )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={"ttfd": "", "ttid": ""},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "ttid_contribution_rate()",
                    "ttid_count()",
                    "ttfd_contribution_rate()",
                    "ttfd_count()",
                ],
                "query": "",
                "orderby": ["-ttid_contribution_rate()"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["ttid_contribution_rate()"] == 0.8
        assert data[0]["ttid_count()"] == 8
        assert data[0]["ttfd_contribution_rate()"] == 0.9
        assert data[0]["ttfd_count()"] == 9
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["ttid_count()"] == "integer"
        assert meta["fields"]["ttid_contribution_rate()"] == "percentage"
        assert meta["fields"]["ttfd_count()"] == "integer"
        assert meta["fields"]["ttfd_contribution_rate()"] == "percentage"

    def test_main_thread_count(self):
        for _ in range(8):
            self.store_span_metric(
                1,
                internal_metric=constants.SELF_TIME_LIGHT,
                tags={"span.main_thread": "true"},
                timestamp=self.min_ago,
            )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={},
            timestamp=self.min_ago,
        )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            tags={"span.main_thread": ""},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "main_thread_count()",
                ],
                "query": "",
                "orderby": ["-main_thread_count()"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["main_thread_count()"] == 8
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["main_thread_count()"] == "integer"

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
            tags={"span.category": "http", "span.description": "f"},
        )
        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "db", "span.description": "e"},
        )
        self.store_span_metric(
            5,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "foobar", "span.description": "d"},
        )
        self.store_span_metric(
            7,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "cache", "span.description": "c"},
        )
        self.store_span_metric(
            9,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "db", "span.op": "db.redis", "span.description": "b"},
        )
        self.store_span_metric(
            11,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.category": "db", "span.op": "db.sql.room", "span.description": "a"},
        )
        response = self.do_request(
            {
                "field": ["span.module", "span.description", "p50(span.self_time)"],
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
        assert len(data) == 6
        assert data[0]["p50(span.self_time)"] == 11
        assert data[0]["span.module"] == "other"
        assert data[0]["span.description"] == "a"
        assert data[1]["p50(span.self_time)"] == 9
        assert data[1]["span.module"] == "cache"
        assert data[1]["span.description"] == "b"
        assert data[2]["p50(span.self_time)"] == 7
        assert data[2]["span.module"] == "cache"
        assert data[2]["span.description"] == "c"
        assert data[3]["p50(span.self_time)"] == 5
        assert data[3]["span.module"] == "other"
        assert data[3]["span.description"] == "d"
        assert data[4]["p50(span.self_time)"] == 3
        assert data[4]["span.module"] == "db"
        assert data[4]["span.description"] == "e"
        assert data[5]["p50(span.self_time)"] == 1
        assert data[5]["span.module"] == "http"
        assert data[5]["span.description"] == "f"
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

    def test_avg_compare(self):
        self.store_span_metric(
            100,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"release": "foo"},
        )
        self.store_span_metric(
            10,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"release": "bar"},
        )

        for function_name in [
            "avg_compare(span.self_time, release, foo, bar)",
            'avg_compare(span.self_time, release, "foo", "bar")',
        ]:
            response = self.do_request(
                {
                    "field": [function_name],
                    "query": "",
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                }
            )
            assert response.status_code == 200, response.content

            data = response.data["data"]
            meta = response.data["meta"]

            assert len(data) == 1
            assert data[0][function_name] == -0.9

            assert meta["dataset"] == "spansMetrics"
            assert meta["fields"][function_name] == "percent_change"

    def test_avg_compare_invalid_column(self):
        response = self.do_request(
            {
                "field": ["avg_compare(span.self_time, transaction, foo, bar)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 400, response.content

    def test_span_domain_array(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,"},
        )
        self.store_span_metric(
            21,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,sentry_table2,"},
        )
        response = self.do_request(
            {
                "field": ["span.domain", "p75(span.self_time)"],
                "query": "",
                "project": self.project.id,
                "orderby": ["-p75(span.self_time)"],
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["span.domain"] == ["sentry_table1"]
        assert data[1]["span.domain"] == ["sentry_table1", "sentry_table2"]
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["span.domain"] == "array"

    def test_span_domain_array_filter(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,"},
        )
        self.store_span_metric(
            21,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,sentry_table2,"},
        )
        response = self.do_request(
            {
                "field": ["span.domain", "p75(span.self_time)"],
                "query": "span.domain:sentry_table2",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.domain"] == ["sentry_table1", "sentry_table2"]
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["span.domain"] == "array"

    def test_span_domain_array_filter_wildcard(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,"},
        )
        self.store_span_metric(
            21,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,sentry_table2,"},
        )
        for query in ["sentry*2", "*table2", "sentry_table2*"]:
            response = self.do_request(
                {
                    "field": ["span.domain", "p75(span.self_time)"],
                    "query": f"span.domain:{query}",
                    "project": self.project.id,
                    "dataset": "spansMetrics",
                }
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            meta = response.data["meta"]
            assert len(data) == 1, query
            assert data[0]["span.domain"] == ["sentry_table1", "sentry_table2"], query
            assert meta["dataset"] == "spansMetrics", query
            assert meta["fields"]["span.domain"] == "array"

    def test_span_domain_array_has_filter(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ""},
        )
        self.store_span_metric(
            21,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,sentry_table2,"},
        )
        response = self.do_request(
            {
                "field": ["span.domain", "p75(span.self_time)"],
                "query": "has:span.domain",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.domain"] == ["sentry_table1", "sentry_table2"]
        assert meta["dataset"] == "spansMetrics"
        response = self.do_request(
            {
                "field": ["span.domain", "p75(span.self_time)"],
                "query": "!has:span.domain",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["span.domain"] == "array"

    def test_unique_values_span_domain(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table1,"},
        )
        self.store_span_metric(
            21,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table2,sentry_table3,"},
        )
        response = self.do_request(
            {
                "field": ["unique.span_domains", "count()"],
                "query": "",
                "orderby": "unique.span_domains",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 3
        assert data[0]["unique.span_domains"] == "sentry_table1"
        assert data[1]["unique.span_domains"] == "sentry_table2"
        assert data[2]["unique.span_domains"] == "sentry_table3"
        assert meta["fields"]["unique.span_domains"] == "string"

    def test_unique_values_span_domain_with_filter(self):
        self.store_span_metric(
            321,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_tible1,"},
        )
        self.store_span_metric(
            21,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.domain": ",sentry_table2,sentry_table3,"},
        )
        response = self.do_request(
            {
                "field": ["unique.span_domains", "count()"],
                "query": "span.domain:sentry_tab*",
                "orderby": "unique.span_domains",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["unique.span_domains"] == "sentry_table2"
        assert data[1]["unique.span_domains"] == "sentry_table3"
        assert meta["fields"]["unique.span_domains"] == "string"

    def test_avg_if(self):
        self.store_span_metric(
            100,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"release": "foo"},
        )
        self.store_span_metric(
            200,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"release": "foo"},
        )
        self.store_span_metric(
            10,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"release": "bar"},
        )

        response = self.do_request(
            {
                "field": ["avg_if(span.self_time, release, foo)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content

        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0]["avg_if(span.self_time, release, foo)"] == 150

        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["avg_if(span.self_time, release, foo)"] == "duration"

    def test_device_class(self):
        self.store_span_metric(
            123,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"device.class": "1"},
        )
        self.store_span_metric(
            678,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"device.class": "2"},
        )
        self.store_span_metric(
            999,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"device.class": ""},
        )
        response = self.do_request(
            {
                "field": ["device.class", "p95()"],
                "query": "",
                "orderby": "p95()",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 3
        # Need to actually check the dict since the level for 1 isn't guaranteed to stay `low` or `medium`
        assert data[0]["device.class"] == map_device_class_level("1")
        assert data[1]["device.class"] == map_device_class_level("2")
        assert data[2]["device.class"] == "Unknown"
        assert meta["fields"]["device.class"] == "string"

    def test_device_class_filter(self):
        self.store_span_metric(
            123,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"device.class": "1"},
        )
        # Need to actually check the dict since the level for 1 isn't guaranteed to stay `low`
        level = map_device_class_level("1")
        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": f"device.class:{level}",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["device.class"] == level
        assert meta["fields"]["device.class"] == "string"


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

    @pytest.mark.xfail(reason="Cannot group by function 'if'")
    def test_span_module(self):
        super().test_span_module()

    @pytest.mark.xfail(reason="Cannot search by tags")
    def test_tag_search(self):
        super().test_tag_search()

    @pytest.mark.xfail(reason="Cannot search by tags")
    def test_free_text_search(self):
        super().test_free_text_search()

    @pytest.mark.xfail(reason="Not implemented")
    def test_avg_compare(self):
        super().test_avg_compare()

    @pytest.mark.xfail(reason="Not implemented")
    def test_span_domain_array(self):
        super().test_span_domain_array()

    @pytest.mark.xfail(reason="Not implemented")
    def test_span_domain_array_filter(self):
        super().test_span_domain_array_filter()

    @pytest.mark.xfail(reason="Not implemented")
    def test_span_domain_array_filter_wildcard(self):
        super().test_span_domain_array_filter_wildcard()

    @pytest.mark.xfail(reason="Not implemented")
    def test_span_domain_array_has_filter(self):
        super().test_span_domain_array_has_filter()

    @pytest.mark.xfail(reason="Not implemented")
    def test_unique_values_span_domain(self):
        super().test_unique_values_span_domain()

    @pytest.mark.xfail(reason="Not implemented")
    def test_unique_values_span_domain_with_filter(self):
        super().test_unique_values_span_domain_with_filter()

    @pytest.mark.xfail(reason="Not implemented")
    def test_avg_if(self):
        super().test_avg_if()

    @pytest.mark.xfail(reason="Not implemented")
    def test_device_class_filter(self):
        super().test_device_class_filter()

    @pytest.mark.xfail(reason="Not implemented")
    def test_device_class(self):
        super().test_device_class()
