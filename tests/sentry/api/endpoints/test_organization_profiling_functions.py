from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

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
        assert response.data == {}

    def test_missing_paramse(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 400
        assert response.data == {
            "function": [ErrorDetail(string="This field is required.", code="required")],
            "trend": [ErrorDetail(string="This field is required.", code="required")],
        }

    def test_bad_trend_type(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"function": "avg()", "trend": "foo"})
        assert response.status_code == 400
        assert response.data == {
            "trend": [
                ErrorDetail(
                    string="Unknown trend type. Expected regression or improvement", code="invalid"
                ),
            ]
        }

    def test_regression(self):
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
        assert 0
