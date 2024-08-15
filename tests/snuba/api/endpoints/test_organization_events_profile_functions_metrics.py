from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics

FUNCTION_DURATION_MRI = "d:profiles/function.duration@millisecond"


class OrganizationEventsProfileFunctionsMetricsEndpointTest(MetricsEnhancedPerformanceTestCase):
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
        self.features = {}

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
                "dataset": "profileFunctionsMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["p50()"] == 0
        assert meta["dataset"] == "profileFunctionsMetrics"

    @pytest.mark.querybuilder
    def test_count(self):
        self.store_profile_functions_metric(
            1,
            timestamp=self.three_days_ago,
        )
        response = self.do_request(
            {
                "field": ["count()"],
                "query": "",
                "project": self.project.id,
                "dataset": "profileFunctionsMetrics",
                "statsPeriod": "7d",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["count()"] == 1
        assert meta["dataset"] == "profileFunctionsMetrics"

    def test_sum(self):
        self.store_profile_functions_metric(
            321,
            timestamp=self.min_ago,
        )
        self.store_profile_functions_metric(
            99,
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["sum(function.duration)"],
                "query": "",
                "project": self.project.id,
                "dataset": "profileFunctionsMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(function.duration)"] == 420
        assert meta["dataset"] == "profileFunctionsMetrics"

    def test_percentile(self):
        self.store_profile_functions_metric(
            1,
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["percentile(function.duration, 0.95)"],
                "query": "",
                "project": self.project.id,
                "dataset": "profileFunctionsMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["percentile(function.duration, 0.95)"] == 1
        assert meta["dataset"] == "profileFunctionsMetrics"

    def test_fixed_percentile_functions(self):
        self.store_profile_functions_metric(
            1,
            timestamp=self.min_ago,
        )
        for function in ["p50()", "p75()", "p95()", "p99()"]:
            response = self.do_request(
                {
                    "field": [function],
                    "query": "",
                    "project": self.project.id,
                    "dataset": "profileFunctionsMetrics",
                }
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            meta = response.data["meta"]
            assert len(data) == 1
            assert data[0][function] == 1, function
            assert meta["dataset"] == "profileFunctionsMetrics", function
            assert meta["fields"][function] == "duration", function

    def test_fixed_percentile_functions_with_duration(self):
        self.store_profile_functions_metric(
            1,
            timestamp=self.min_ago,
        )
        for function in [
            "p50(function.duration)",
            "p75(function.duration)",
            "p95(function.duration)",
            "p99(function.duration)",
        ]:
            response = self.do_request(
                {
                    "field": [function],
                    "query": "",
                    "project": self.project.id,
                    "dataset": "profileFunctionsMetrics",
                }
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            meta = response.data["meta"]
            assert len(data) == 1, function
            assert data[0][function] == 1, function
            assert meta["dataset"] == "profileFunctionsMetrics", function
            assert meta["fields"][function] == "duration", function

    def test_avg(self):
        self.store_profile_functions_metric(
            1,
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": ["avg()"],
                "query": "",
                "project": self.project.id,
                "dataset": "profileFunctionsMetrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["avg()"] == 1
        assert meta["dataset"] == "profileFunctionsMetrics"

    # This needs to be revisited
    # see --> Column name was not found in metrics indexer
    def test_regression_score_regression(self):
        # This function increases in duration
        self.store_profile_functions_metric(
            1,
            timestamp=self.six_min_ago,
            tags={"function": "func_a", "release": "Regressed"},
            project=self.project.id,
        )
        self.store_profile_functions_metric(
            100,
            timestamp=self.min_ago,
            tags={"function": "func_a", "release": "Regressed"},
            project=self.project.id,
        )

        # This function stays the same
        self.store_profile_functions_metric(
            1,
            timestamp=self.three_days_ago,
            tags={"function": "func_a", "release": "Non-regressed"},
            project=self.project.id,
        )
        self.store_profile_functions_metric(
            1,
            timestamp=self.min_ago,
            tags={"function": "func_a", "release": "Non-regressed"},
            project=self.project.id,
        )

        response = self.do_request(
            {
                "field": [
                    "release",
                    f"regression_score(function.duration,{int(self.two_min_ago.timestamp())}, 0.95)",
                ],
                "query": "function:func_a",
                "dataset": "profileFunctionsMetrics",
                "orderby": [
                    f"-regression_score(function.duration,{int(self.two_min_ago.timestamp())}, 0.95)"
                ],
                "start": (self.six_min_ago - timedelta(minutes=1)).isoformat(),
                "end": before_now(minutes=0),
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert [row["release"] for row in data] == ["Regressed", "Non-regressed"]
