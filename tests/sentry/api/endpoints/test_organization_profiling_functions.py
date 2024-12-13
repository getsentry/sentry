from datetime import timedelta
from unittest import mock

from django.urls import reverse

from sentry.api.endpoints.organization_profiling_functions import (
    TOP_FUNCTIONS_LIMIT,
    get_rollup_from_range,
)
from sentry.constants import MAX_ROLLUP_POINTS
from sentry.testutils.cases import ProfilesSnubaTestCase
from sentry.testutils.helpers.datetime import before_now

PROFILING_FEATURES = {
    "organizations:profiling-global-suspect-functions": True,
}


class OrganizationProfilingFunctionTrendsEndpointTest(ProfilesSnubaTestCase):
    endpoint = "sentry-api-0-organization-profiling-function-trends"

    def setUp(self):
        super().setUp()

        self.ten_mins_ago = before_now(minutes=10)
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))
        self.project  # this is lazily created

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_project(self):
        org = self.create_organization(name="foo", owner=self.user)
        url = reverse(self.endpoint, args=(org.slug,))

        with self.feature(PROFILING_FEATURES):
            response = self.client.get(url)

        assert response.status_code == 200
        assert response.json() == {}

    def test_missing_paramse(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 400
        assert response.json() == {
            "function": ["This field is required."],
            "trend": ["This field is required."],
        }

    def test_bad_trend_type(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"function": "avg()", "trend": "foo"})
        assert response.status_code == 400
        assert response.json() == {
            "trend": [
                "Unknown trend type. Expected regression or improvement",
            ]
        }

    @mock.patch("sentry.api.endpoints.organization_profiling_functions.detect_breakpoints")
    def test_min_threshold(self, mock_detect_breakpoints):
        n = 25
        for i in range(n):
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 * 1e6 if i < n / 2 else 110 * 1e6],
                        "package": "foo",
                        "function": "bar",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=10),
            )
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 * 1e6 if i < n / 2 else 1000 * 1e6],
                        "package": "foo",
                        "function": "baz",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=11),
            )

        mock_detect_breakpoints.return_value = {
            "data": [
                {
                    "absolute_percentage_change": 0.9090909090909091,
                    "aggregate_range_1": 110000000.0,
                    "aggregate_range_2": 100000000.0,
                    "breakpoint": 1688022000,
                    "change": "improvement",
                    "project": str(self.project.id),
                    "transaction": str(
                        self.function_fingerprint({"package": "foo", "function": "bar"})
                        & 0xFFFFFFFF
                    ),
                    "trend_difference": -10000000.0,
                    "trend_percentage": 0.9090909090909091,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": float("inf"),
                },
                {
                    "absolute_percentage_change": 0.1,
                    "aggregate_range_1": 1000000000.0,
                    "aggregate_range_2": 100000000.0,
                    "breakpoint": 1688022000,
                    "change": "improvement",
                    "project": str(self.project.id),
                    "transaction": str(
                        self.function_fingerprint({"package": "foo", "function": "baz"})
                        & 0xFFFFFFFF
                    ),
                    "trend_difference": -900000000.0,
                    "trend_percentage": 0.1,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": float("inf"),
                },
            ]
        }

        with self.feature(PROFILING_FEATURES):
            response = self.client.get(
                self.url,
                {
                    "function": "avg()",
                    "query": "is_application:1",
                    "trend": "improvement",
                    "statsPeriod": "24h",
                    "threshold": "20",
                },
            )
        assert response.status_code == 200
        results = response.json()
        assert [(result["package"], result["function"]) for result in results] == [("foo", "baz")]

    @mock.patch("sentry.api.endpoints.organization_profiling_functions.detect_breakpoints")
    def test_regression(self, mock_detect_breakpoints):
        n = 25
        for i in range(n):
            self.store_functions(
                [
                    {
                        "self_times_ns": [500 * 1e6 if i < n / 2 else 100 * 1e6],
                        "package": "foo",
                        "function": "bar",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=10),
            )
            self.store_functions(
                [
                    {
                        "self_times_ns": [1000 * 1e6 if i < n / 2 else 100 * 1e6],
                        "package": "foo",
                        "function": "baz",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=11),
            )

        mock_detect_breakpoints.return_value = {
            "data": [
                {
                    "absolute_percentage_change": 5.0,
                    "aggregate_range_1": 100000000.0,
                    "aggregate_range_2": 500000000.0,
                    "breakpoint": 1687323600,
                    "change": "regression",
                    "project": str(self.project.id),
                    "transaction": str(
                        self.function_fingerprint({"package": "foo", "function": "baz"})
                        & 0xFFFFFFFF
                    ),
                    "trend_difference": 400000000.0,
                    "trend_percentage": 5.0,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": -float("inf"),
                },
                {
                    "absolute_percentage_change": 10.0,
                    "aggregate_range_1": 100000000.0,
                    "aggregate_range_2": 1000000000.0,
                    "breakpoint": 1687323600,
                    "change": "regression",
                    "project": str(self.project.id),
                    "transaction": str(
                        self.function_fingerprint({"package": "foo", "function": "bar"})
                        & 0xFFFFFFFF
                    ),
                    "trend_difference": 900000000.0,
                    "trend_percentage": 10.0,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": -float("inf"),
                },
            ]
        }

        with self.feature(PROFILING_FEATURES):
            response = self.client.get(
                self.url,
                {
                    "function": "avg()",
                    "query": "is_application:1",
                    "trend": "regression",
                    "statsPeriod": "24h",
                },
            )
        assert response.status_code == 200
        # TODO: assert response json
        results = response.json()
        assert results
        trend_percentages = [data["trend_percentage"] for data in results]
        assert trend_percentages == [10.0, 5.0]
        for data in results:
            assert isinstance(data["worst"], list)
            assert isinstance(data["examples"], list)

    @mock.patch("sentry.api.endpoints.organization_profiling_functions.detect_breakpoints")
    def test_improvement(self, mock_detect_breakpoints):
        n = 25
        for i in range(n):
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 * 1e6 if i < n / 2 else 500 * 1e6],
                        "package": "foo",
                        "function": "bar",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=10),
            )
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 * 1e6 if i < n / 2 else 1000 * 1e6],
                        "package": "foo",
                        "function": "baz",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=11),
            )

        mock_detect_breakpoints.return_value = {
            "data": [
                {
                    "absolute_percentage_change": 0.2,
                    "aggregate_range_1": 500000000.0,
                    "aggregate_range_2": 100000000.0,
                    "breakpoint": 1687323600,
                    "change": "improvement",
                    "project": str(self.project.id),
                    "transaction": str(
                        self.function_fingerprint({"package": "foo", "function": "bar"})
                        & 0xFFFFFFFF
                    ),
                    "trend_difference": -400000000.0,
                    "trend_percentage": 0.2,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": float("inf"),
                },
                {
                    "absolute_percentage_change": 0.1,
                    "aggregate_range_1": 1000000000.0,
                    "aggregate_range_2": 100000000.0,
                    "breakpoint": 1687323600,
                    "change": "improvement",
                    "project": str(self.project.id),
                    "transaction": str(
                        self.function_fingerprint({"package": "foo", "function": "baz"})
                        & 0xFFFFFFFF
                    ),
                    "trend_difference": -900000000.0,
                    "trend_percentage": 0.1,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": float("inf"),
                },
            ]
        }

        with self.feature(PROFILING_FEATURES):
            response = self.client.get(
                self.url,
                {
                    "function": "avg()",
                    "query": "is_application:1",
                    "trend": "improvement",
                    "statsPeriod": "24h",
                },
            )
        assert response.status_code == 200
        # TODO: assert response json
        results = response.json()
        assert results
        trend_percentages = [data["trend_percentage"] for data in results]
        assert trend_percentages == [0.1, 0.2]
        for data in results:
            assert isinstance(data["worst"], list)
            assert isinstance(data["examples"], list)


def test_get_rollup_from_range_max_buckets():
    max_buckets = int(MAX_ROLLUP_POINTS / TOP_FUNCTIONS_LIMIT)

    for days in range(90):
        for hours in range(24):
            date_range = timedelta(days=days, hours=hours)
            rollup = get_rollup_from_range(date_range)

            error = f"days={days} hours={hours} interval={rollup}"

            buckets = int(date_range.total_seconds() / rollup)
            assert buckets <= max_buckets, error
