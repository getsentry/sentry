from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

PROFILING_FEATURES = {"organizations:profiling": True}


@region_silo_test
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
