from datetime import timedelta
from unittest import mock

from django.urls import reverse

from sentry.api.endpoints.organization_profiling_functions import (
    TOP_FUNCTIONS_LIMIT,
    get_rollup_from_range,
)
from sentry.constants import MAX_ROLLUP_POINTS
from sentry.testutils import ProfilesSnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test

PROFILING_FEATURES = {
    "organizations:profiling-global-suspect-functions": True,
}


@region_silo_test
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

    @mock.patch("sentry.api.endpoints.organization_profiling_functions.trends_query")
    def test_regression(self, mock_trends_query):
        n = 25
        for i in range(n):
            self.store_functions(
                [
                    {
                        "self_times_ns": [500 if i < n / 2 else 100],
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
                        "self_times_ns": [1000 if i < n / 2 else 100],
                        "package": "foo",
                        "function": "baz",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=11),
            )

        mock_trends_query.return_value = [
            {
                "aggregate_range_1": 100.0,
                "aggregate_range_2": 930.7692307692307,
                "breakpoint": 1686621600,
                "change": "regression",
                "project": str(self.project.id),
                "transaction": str(
                    self.function_fingerprint({"package": "foo", "function": "bar"})
                ),
                "trend_difference": 830.7692307692307,
                "trend_percentage": 9.307692307692307,
                "unweighted_p_value": 4.84e-08,
                "unweighted_t_value": -12.0,
            },
            {
                "aggregate_range_1": 100.0,
                "aggregate_range_2": 469.2307692307692,
                "breakpoint": 1686621600,
                "change": "regression",
                "project": str(self.project.id),
                "transaction": str(
                    self.function_fingerprint({"package": "foo", "function": "baz"})
                ),
                "trend_difference": 369.2307692307692,
                "trend_percentage": 4.6923076923076925,
                "unweighted_p_value": 4.84e-08,
                "unweighted_t_value": -12.000000000000002,
            },
        ]

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
        assert response.json()

    @mock.patch("sentry.api.endpoints.organization_profiling_functions.trends_query")
    def test_improvement(self, mock_trends_query):
        n = 25
        for i in range(n):
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 if i < n / 2 else 500],
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
                        "self_times_ns": [100 if i < n / 2 else 1000],
                        "package": "foo",
                        "function": "baz",
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=before_now(hours=i, minutes=11),
            )

        mock_trends_query.return_value = [
            {
                "aggregate_range_1": 1000.0,
                "aggregate_range_2": 164.28571428571428,
                "breakpoint": 1686625200,
                "change": "improvement",
                "project": str(self.project.id),
                "transaction": str(
                    self.function_fingerprint({"package": "foo", "function": "baz"})
                ),
                "trend_difference": -835.7142857142858,
                "trend_percentage": 0.16428571428571428,
                "unweighted_p_value": 8e-09,
                "unweighted_t_value": 13.0,
            },
            {
                "aggregate_range_1": 500.0,
                "aggregate_range_2": 128.57142857142858,
                "breakpoint": 1686625200,
                "change": "improvement",
                "project": str(self.project.id),
                "transaction": str(
                    self.function_fingerprint({"package": "foo", "function": "bar"})
                ),
                "trend_difference": -371.42857142857144,
                "trend_percentage": 0.2571428571428572,
                "unweighted_p_value": 8e-09,
                "unweighted_t_value": 12.999999999999998,
            },
        ]

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
        assert response.json()


def test_get_rollup_from_range_max_buckets():
    max_buckets = int(MAX_ROLLUP_POINTS / TOP_FUNCTIONS_LIMIT)

    for days in range(90):
        for hours in range(24):
            date_range = timedelta(days=days, hours=hours)
            rollup = get_rollup_from_range(date_range)

            error = f"days={days} hours={hours} interval={rollup}"

            buckets = int(date_range.total_seconds() / rollup)
            assert buckets <= max_buckets, error
