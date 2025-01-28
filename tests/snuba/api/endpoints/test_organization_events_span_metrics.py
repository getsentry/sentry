from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.search.events import constants
from sentry.search.utils import map_device_class_level
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics

SPAN_DURATION_MRI = "d:spans/duration@millisecond"


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
            kwargs={"organization_id_or_slug": self.organization.slug},
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

    @pytest.mark.querybuilder
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

    def test_count_if(self):
        self.store_span_metric(
            2,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.three_days_ago,
            tags={"release": "1.0.0"},
        )
        self.store_span_metric(
            2,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.three_days_ago,
            tags={"release": "1.0.0"},
        )
        self.store_span_metric(
            2,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.three_days_ago,
            tags={"release": "2.0.0"},
        )

        fieldRelease1 = "count_if(release,1.0.0)"
        fieldRelease2 = "count_if(release,2.0.0)"
        response = self.do_request(
            {
                "field": [fieldRelease1, fieldRelease2],
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
        assert data[0][fieldRelease1] == 2
        assert data[0][fieldRelease2] == 1
        assert meta["dataset"] == "spansMetrics"

    def test_division(self):
        # 10 slow frames, 20 frozen frames, 100 total frames
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 10,
                "count": 10,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.slow_frames",
            timestamp=self.three_days_ago,
        )
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 20,
                "count": 20,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.frozen_frames",
            timestamp=self.three_days_ago,
        )
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 100,
                "count": 100,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.total_frames",
            timestamp=self.three_days_ago,
        )

        slow_frame_rate = "division(mobile.slow_frames,mobile.total_frames)"
        frozen_frame_rate = "division(mobile.frozen_frames,mobile.total_frames)"

        response = self.do_request(
            {
                "field": [slow_frame_rate, frozen_frame_rate],
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

        assert data[0][slow_frame_rate] == 10 / 100
        assert data[0][frozen_frame_rate] == 20 / 100

        assert meta["dataset"] == "spansMetrics"

    def test_division_if(self):
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 1,
                "count": 1,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.slow_frames",
            timestamp=self.three_days_ago,
            tags={"release": "1.0.0"},
        )
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 15,
                "count": 15,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.total_frames",
            timestamp=self.three_days_ago,
            tags={"release": "1.0.0"},
        )
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 2,
                "count": 2,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.frozen_frames",
            timestamp=self.three_days_ago,
            tags={"release": "2.0.0"},
        )
        self.store_span_metric(
            {
                "min": 1,
                "max": 1,
                "sum": 10,
                "count": 10,
                "last": 1,
            },
            entity="metrics_gauges",
            metric="mobile.total_frames",
            timestamp=self.three_days_ago,
            tags={"release": "2.0.0"},
        )

        fieldRelease1 = "division_if(mobile.slow_frames,mobile.total_frames,release,1.0.0)"
        fieldRelease2 = "division_if(mobile.frozen_frames,mobile.total_frames,release,2.0.0)"

        response = self.do_request(
            {
                "field": [fieldRelease1, fieldRelease2],
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
        assert data[0][fieldRelease1] == 1 / 15
        assert data[0][fieldRelease2] == 2 / 10

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

    def test_avg_on_http_response(self):
        self.store_span_metric(
            10,
            internal_metric=constants.SPAN_METRICS_MAP["http.response_content_length"],
            timestamp=self.min_ago,
        )

        self.store_span_metric(
            15,
            internal_metric=constants.SPAN_METRICS_MAP["http.response_transfer_size"],
            timestamp=self.min_ago,
        )

        self.store_span_metric(
            20,
            internal_metric=constants.SPAN_METRICS_MAP["http.decoded_response_content_length"],
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "avg(http.response_content_length)",
                    "avg(http.response_transfer_size)",
                    "avg(http.decoded_response_content_length)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["avg(http.response_content_length)"] == 10
        assert data[0]["avg(http.response_transfer_size)"] == 15
        assert data[0]["avg(http.decoded_response_content_length)"] == 20

        meta = response.data["meta"]
        assert meta["fields"]["avg(http.response_content_length)"] == "size"
        assert meta["fields"]["avg(http.response_transfer_size)"] == "size"
        assert meta["fields"]["avg(http.decoded_response_content_length)"] == "size"

        assert meta["units"]["avg(http.response_content_length)"] == "byte"
        assert meta["units"]["avg(http.response_transfer_size)"] == "byte"
        assert meta["units"]["avg(http.decoded_response_content_length)"] == "byte"

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

    def test_time_spent_percentage_on_span_duration(self):
        for _ in range(4):
            self.store_span_metric(
                1,
                internal_metric=constants.SPAN_METRICS_MAP["span.duration"],
                tags={"transaction": "foo_transaction"},
                timestamp=self.min_ago,
            )
        self.store_span_metric(
            1,
            internal_metric=constants.SPAN_METRICS_MAP["span.duration"],
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["transaction", "time_spent_percentage(app,span.duration)"],
                "query": "",
                "orderby": ["-time_spent_percentage(app,span.duration)"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["time_spent_percentage(app,span.duration)"] == 0.8
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["time_spent_percentage(app,span.duration)"] == 0.2
        assert data[1]["transaction"] == "bar_transaction"
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
        self.store_span_metric(
            300,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.op": "queue.process"},
        )

        response = self.do_request(
            {
                "field": [
                    "avg_if(span.self_time, release, foo)",
                    "avg_if(span.self_time, span.op, queue.process)",
                ],
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
        assert data[0]["avg_if(span.self_time, span.op, queue.process)"] == 300

        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["avg_if(span.self_time, release, foo)"] == "duration"
        assert meta["fields"]["avg_if(span.self_time, span.op, queue.process)"] == "duration"

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

    def test_device_class_filter_unknown(self):
        self.store_span_metric(
            123,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"device.class": ""},
        )
        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": "device.class:Unknown",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["device.class"] == "Unknown"
        assert meta["fields"]["device.class"] == "string"

    def test_cache_hit_rate(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"cache.hit": "true"},
        )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        response = self.do_request(
            {
                "field": ["cache_hit_rate()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["cache_hit_rate()"] == 0.5
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["cache_hit_rate()"] == "percentage"

    def test_cache_miss_rate(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"cache.hit": "true"},
        )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        response = self.do_request(
            {
                "field": ["cache_miss_rate()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["cache_miss_rate()"] == 0.75
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["cache_miss_rate()"] == "percentage"

    def test_http_response_rate(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.status_code": "200"},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.status_code": "301"},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.status_code": "404"},
        )

        self.store_span_metric(
            4,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.status_code": "503"},
        )

        self.store_span_metric(
            5,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"span.status_code": "501"},
        )

        response = self.do_request(
            {
                "field": [
                    "http_response_rate(200)",  # By exact code
                    "http_response_rate(3)",  # By code class
                    "http_response_rate(4)",
                    "http_response_rate(5)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["http_response_rate(200)"] == 0.2
        assert data[0]["http_response_rate(3)"] == 0.2
        assert data[0]["http_response_rate(4)"] == 0.2
        assert data[0]["http_response_rate(5)"] == 0.4

        meta = response.data["meta"]
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["http_response_rate(200)"] == "percentage"

    def test_regression_score_regression(self):
        # This span increases in duration
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.six_min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Regressed Span"},
            project=self.project.id,
        )
        self.store_span_metric(
            100,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Regressed Span"},
            project=self.project.id,
        )

        # This span stays the same
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.three_days_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Non-regressed"},
            project=self.project.id,
        )
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Non-regressed"},
            project=self.project.id,
        )

        response = self.do_request(
            {
                "field": [
                    "span.description",
                    f"regression_score(span.duration,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "transaction:/api/0/projects/",
                "dataset": "spansMetrics",
                "orderby": [
                    f"-regression_score(span.duration,{int(self.two_min_ago.timestamp())})"
                ],
                "start": (self.six_min_ago - timedelta(minutes=1)).isoformat(),
                "end": before_now(minutes=0),
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert [row["span.description"] for row in data] == ["Regressed Span", "Non-regressed"]

    def test_regression_score_added_span(self):
        # This span only exists after the breakpoint
        self.store_span_metric(
            100,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Added span"},
            project=self.project.id,
        )

        # This span stays the same
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.three_days_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Non-regressed"},
            project=self.project.id,
        )
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Non-regressed"},
            project=self.project.id,
        )

        response = self.do_request(
            {
                "field": [
                    "span.description",
                    f"regression_score(span.duration,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "transaction:/api/0/projects/",
                "dataset": "spansMetrics",
                "orderby": [
                    f"-regression_score(span.duration,{int(self.two_min_ago.timestamp())})"
                ],
                "start": (self.six_min_ago - timedelta(minutes=1)).isoformat(),
                "end": before_now(minutes=0),
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert [row["span.description"] for row in data] == ["Added span", "Non-regressed"]

    def test_regression_score_removed_span(self):
        # This span only exists before the breakpoint
        self.store_span_metric(
            100,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.six_min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Removed span"},
            project=self.project.id,
        )

        # This span stays the same
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.three_days_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Non-regressed"},
            project=self.project.id,
        )
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.min_ago,
            tags={"transaction": "/api/0/projects/", "span.description": "Non-regressed"},
            project=self.project.id,
        )

        response = self.do_request(
            {
                "field": [
                    "span.description",
                    f"regression_score(span.duration,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "transaction:/api/0/projects/",
                "dataset": "spansMetrics",
                "orderby": [
                    f"-regression_score(span.duration,{int(self.two_min_ago.timestamp())})"
                ],
                "start": (self.six_min_ago - timedelta(minutes=1)).isoformat(),
                "end": before_now(minutes=0),
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert [row["span.description"] for row in data] == ["Non-regressed", "Removed span"]

        # The regression score is <0 for removed spans, this can act as
        # a way to filter out removed spans when necessary
        assert data[1][f"regression_score(span.duration,{int(self.two_min_ago.timestamp())})"] < 0

    def test_avg_self_time_by_timestamp(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={},
        )

        response = self.do_request(
            {
                "field": [
                    f"avg_by_timestamp(span.self_time,less,{int(self.two_min_ago.timestamp())})",
                    f"avg_by_timestamp(span.self_time,greater,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0] == {
            f"avg_by_timestamp(span.self_time,less,{int(self.two_min_ago.timestamp())})": 1.0,
            f"avg_by_timestamp(span.self_time,greater,{int(self.two_min_ago.timestamp())})": 3.0,
        }

    def test_avg_self_time_by_timestamp_invalid_condition(self):
        response = self.do_request(
            {
                "field": [
                    f"avg_by_timestamp(span.self_time,INVALID_ARG,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "avg_by_timestamp: condition argument invalid: string must be one of ['greater', 'less']"
        )

    def test_epm_by_timestamp(self):
        self.store_span_metric(
            1,
            internal_metric=SPAN_DURATION_MRI,
            timestamp=self.six_min_ago,
            tags={},
        )

        # More events occur after the timestamp
        for _ in range(3):
            self.store_span_metric(
                3,
                internal_metric=SPAN_DURATION_MRI,
                timestamp=self.min_ago,
                tags={},
            )

        response = self.do_request(
            {
                "field": [
                    f"epm_by_timestamp(less,{int(self.two_min_ago.timestamp())})",
                    f"epm_by_timestamp(greater,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0][f"epm_by_timestamp(less,{int(self.two_min_ago.timestamp())})"] < 1.0
        assert data[0][f"epm_by_timestamp(greater,{int(self.two_min_ago.timestamp())})"] > 1.0

    def test_epm_by_timestamp_invalid_condition(self):
        response = self.do_request(
            {
                "field": [
                    f"epm_by_timestamp(INVALID_ARG,{int(self.two_min_ago.timestamp())})",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "epm_by_timestamp: condition argument invalid: string must be one of ['greater', 'less']"
        )

    def test_any_function(self):
        for char in "abc":
            for transaction in ["foo", "bar"]:
                self.store_span_metric(
                    1,
                    internal_metric=constants.SELF_TIME_LIGHT,
                    timestamp=self.six_min_ago,
                    tags={"span.description": char, "transaction": transaction},
                )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "any(span.description)",
                ],
                "query": "",
                "orderby": ["transaction"],
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"transaction": "bar", "any(span.description)": "a"},
            {"transaction": "foo", "any(span.description)": "a"},
        ]

    def test_count_op(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.op": "queue.publish"},
        )

        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={"span.op": "queue.process"},
        )

        response = self.do_request(
            {
                "field": [
                    "count_op(queue.publish)",
                    "count_op(queue.process)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data == [
            {"count_op(queue.publish)": 1, "count_op(queue.process)": 1},
        ]

    def test_project_mapping(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.six_min_ago,
            tags={},
        )

        # More events occur after the timestamp
        for _ in range(3):
            self.store_span_metric(
                3,
                internal_metric=constants.SELF_TIME_LIGHT,
                timestamp=self.min_ago,
                tags={},
            )

        response = self.do_request(
            {
                "field": ["project", "project.name", "count()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        assert data[0]["project"] == self.project.slug
        assert data[0]["project.name"] == self.project.slug

    def test_slow_frames_gauge_metric(self):
        self.store_span_metric(
            {
                "min": 5,
                "max": 5,
                "sum": 5,
                "count": 1,
                "last": 5,
            },
            entity="metrics_gauges",
            metric="mobile.slow_frames",
            timestamp=self.six_min_ago,
            tags={"release": "foo"},
        )
        self.store_span_metric(
            {
                "min": 10,
                "max": 10,
                "sum": 10,
                "count": 1,
                "last": 10,
            },
            entity="metrics_gauges",
            metric="mobile.slow_frames",
            timestamp=self.six_min_ago,
            tags={"release": "bar"},
        )

        response = self.do_request(
            {
                "field": [
                    "avg_if(mobile.slow_frames,release,foo)",
                    "avg_if(mobile.slow_frames,release,bar)",
                    "avg_compare(mobile.slow_frames,release,foo,bar)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data == [
            {
                "avg_compare(mobile.slow_frames,release,foo,bar)": 1.0,
                "avg_if(mobile.slow_frames,release,foo)": 5.0,
                "avg_if(mobile.slow_frames,release,bar)": 10.0,
            }
        ]

    def test_frames_delay_gauge_metric(self):
        self.store_span_metric(
            {
                "min": 5,
                "max": 5,
                "sum": 5,
                "count": 1,
                "last": 5,
            },
            entity="metrics_gauges",
            metric="mobile.frames_delay",
            timestamp=self.six_min_ago,
            tags={"release": "foo"},
        )
        self.store_span_metric(
            {
                "min": 10,
                "max": 10,
                "sum": 10,
                "count": 1,
                "last": 10,
            },
            entity="metrics_gauges",
            metric="mobile.frames_delay",
            timestamp=self.six_min_ago,
            tags={"release": "bar"},
        )

        response = self.do_request(
            {
                "field": [
                    "avg_if(mobile.frames_delay,release,foo)",
                    "avg_if(mobile.frames_delay,release,bar)",
                    "avg_compare(mobile.frames_delay,release,foo,bar)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert data == [
            {
                "avg_compare(mobile.frames_delay,release,foo,bar)": 1.0,
                "avg_if(mobile.frames_delay,release,foo)": 5.0,
                "avg_if(mobile.frames_delay,release,bar)": 10.0,
            }
        ]
        assert meta["units"]["avg_if(mobile.frames_delay,release,foo)"] == "second"
        assert meta["units"]["avg_if(mobile.frames_delay,release,bar)"] == "second"
        assert meta["units"]["avg_compare(mobile.frames_delay,release,foo,bar)"] is None

    def test_resolve_messaging_message_receive_latency_gauge(self):
        self.store_span_metric(
            {
                "min": 5,
                "max": 5,
                "sum": 5,
                "count": 1,
                "last": 5,
            },
            entity="metrics_gauges",
            metric="messaging.message.receive.latency",
            timestamp=self.six_min_ago,
            tags={"messaging.destination.name": "foo", "trace.status": "ok"},
        )
        self.store_span_metric(
            {
                "min": 10,
                "max": 10,
                "sum": 10,
                "count": 1,
                "last": 10,
            },
            entity="metrics_gauges",
            metric="messaging.message.receive.latency",
            timestamp=self.six_min_ago,
            tags={"messaging.destination.name": "bar", "trace.status": "ok"},
        )
        response = self.do_request(
            {
                "field": [
                    "messaging.destination.name",
                    "trace.status",
                    "avg(messaging.message.receive.latency)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data == [
            {
                "messaging.destination.name": "bar",
                "trace.status": "ok",
                "avg(messaging.message.receive.latency)": 10.0,
            },
            {
                "messaging.destination.name": "foo",
                "trace.status": "ok",
                "avg(messaging.message.receive.latency)": 5.0,
            },
        ]

    def test_messaging_does_not_exist_as_metric(self):
        self.store_span_metric(
            100,
            internal_metric=constants.SPAN_METRICS_MAP["span.duration"],
            tags={"messaging.destination.name": "foo", "trace.status": "ok"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "messaging.destination.name",
                    "trace.status",
                    "avg(messaging.message.receive.latency)",
                    "avg(span.duration)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data == [
            {
                "messaging.destination.name": "foo",
                "trace.status": "ok",
                "avg(messaging.message.receive.latency)": None,
                "avg(span.duration)": 100,
            },
        ]
        meta = response.data["meta"]
        assert meta["fields"]["avg(messaging.message.receive.latency)"] == "null"

    def test_cache_item_size_does_not_exist_as_metric(self):
        self.store_span_metric(
            100,
            internal_metric=constants.SPAN_METRICS_MAP["span.duration"],
            tags={"cache.item": "true"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "avg(cache.item_size)",
                    "avg(span.duration)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data == [
            {
                "avg(cache.item_size)": None,
                "avg(span.duration)": 100,
            },
        ]
        meta = response.data["meta"]
        assert meta["fields"]["avg(cache.item_size)"] == "null"

    def test_trace_status_rate(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "unknown"},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "internal_error"},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "unauthenticated"},
        )

        self.store_span_metric(
            4,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "ok"},
        )

        self.store_span_metric(
            5,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "ok"},
        )

        response = self.do_request(
            {
                "field": [
                    "trace_status_rate(ok)",
                    "trace_status_rate(unknown)",
                    "trace_status_rate(internal_error)",
                    "trace_status_rate(unauthenticated)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
                "statsPeriod": "1h",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["trace_status_rate(ok)"] == 0.4
        assert data[0]["trace_status_rate(unknown)"] == 0.2
        assert data[0]["trace_status_rate(internal_error)"] == 0.2
        assert data[0]["trace_status_rate(unauthenticated)"] == 0.2

        meta = response.data["meta"]
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["trace_status_rate(ok)"] == "percentage"
        assert meta["fields"]["trace_status_rate(unknown)"] == "percentage"
        assert meta["fields"]["trace_status_rate(internal_error)"] == "percentage"
        assert meta["fields"]["trace_status_rate(unauthenticated)"] == "percentage"

    def test_trace_error_rate(self):
        self.store_span_metric(
            1,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "unknown"},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "internal_error"},
        )

        self.store_span_metric(
            3,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "unauthenticated"},
        )

        self.store_span_metric(
            4,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "ok"},
        )

        self.store_span_metric(
            5,
            internal_metric=constants.SELF_TIME_LIGHT,
            timestamp=self.min_ago,
            tags={"trace.status": "ok"},
        )

        response = self.do_request(
            {
                "field": [
                    "trace_error_rate()",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "spansMetrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["trace_error_rate()"] == 0.4

        meta = response.data["meta"]
        assert meta["dataset"] == "spansMetrics"
        assert meta["fields"]["trace_error_rate()"] == "percentage"


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
    def test_time_spent_percentage_on_span_duration(self):
        super().test_time_spent_percentage_on_span_duration()

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

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_op(self):
        super().test_count_op()
