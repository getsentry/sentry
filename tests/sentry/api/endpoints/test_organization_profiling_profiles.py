from django.urls import reverse
from freezegun import freeze_time
from rest_framework.exceptions import ErrorDetail

from sentry.testutils import APITestCase

PROFILING_FEATURES = {"organizations:profiling": True}


class OrganizationProfilingProfilesTest(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-profiles"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_bad_filter(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"query": "foo:bar"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid query: foo is not supported", code="parse_error")
        }

    def test_no_projects(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []


class OrganizationProfilingFiltersTest(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-filters"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_bad_filter(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"query": "foo:bar"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid query: foo is not supported", code="parse_error")
        }

    def test_no_projects(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []


class OrganizationProfilingTransactionsTest(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-transactions"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_bad_filter(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"query": "foo:bar"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid query: foo is not supported", code="parse_error")
        }

    def test_no_projects(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []


class OrganizationProfilingStatsTest(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-stats"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_bad_filter(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"query": "foo:bar"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid query: foo is not supported", code="parse_error")
        }

    @freeze_time("2022-08-12 13:45:11")
    def test_no_projects(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == {
            "data": [],
            "meta": {
                "dataset": "profiles",
                "start": 1652486400,
                "end": 1660262400,
            },
            "timestamps": [],
        }, response.data["meta"]
