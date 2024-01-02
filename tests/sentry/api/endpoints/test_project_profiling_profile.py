from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

PROFILING_FEATURES = {"organizations:profiling": True}


@region_silo_test
class ProjectProfilingProfileTest(APITestCase):
    endpoint = "sentry-api-0-project-profiling-profile"

    def setUp(self):
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self):
        response = self.get_response(self.project.organization.slug, self.project.id, str(uuid4()))
        assert response.status_code == 404


@region_silo_test
class ProjectProfilingFunctionsEndpoint(APITestCase):
    endpoint = "sentry-api-0-project-profiling-functions"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_feature_flag_disabled(self):
        response = self.get_response(self.project.organization.slug, self.project.id)
        assert response.status_code == 404

    def test_bad_filter(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"query": "foo:bar"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid query: foo is not supported", code="parse_error")
        }

    @patch("sentry.api.endpoints.project_profiling_profile.get_from_profiling_service")
    def test_basic(self, mock_proxy):
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"functions": []})
        mock_proxy.return_value = mock_response
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"sort": "count"})
        assert response.status_code == 200
        assert mock_proxy.call_count == 1
        kwargs = mock_proxy.call_args[1]
        assert kwargs["params"]["sort"] == "count"
        assert kwargs["params"]["offset"] == 0
        assert kwargs["params"]["limit"] == 6

    def test_is_application_invalid(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"is_application": "asdf"})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(
                string="Invalid query: Illegal value for is_application", code="parse_error"
            )
        }

    @patch("sentry.api.endpoints.project_profiling_profile.get_from_profiling_service")
    def test_is_application_true(self, mock_proxy):
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"functions": []})
        mock_proxy.return_value = mock_response
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"is_application": "1", "sort": "count"})
        assert response.status_code == 200
        assert mock_proxy.call_count == 1
        kwargs = mock_proxy.call_args[1]
        assert kwargs["params"]["is_application"] == "1"

    @patch("sentry.api.endpoints.project_profiling_profile.get_from_profiling_service")
    def test_is_application_false(self, mock_proxy):
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = json.dumps({"functions": []})
        mock_proxy.return_value = mock_response
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"is_application": "0", "sort": "count"})
        assert response.status_code == 200, response.data
        assert mock_proxy.call_count == 1
        kwargs = mock_proxy.call_args[1]
        assert kwargs["params"]["is_application"] == "0"

    def test_sort_missing(self):
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(
                string="Invalid query: Missing value for sort", code="parse_error"
            )
        }

    @patch("sentry.api.endpoints.project_profiling_profile.get_from_profiling_service")
    def test_bad_response(self, mock_proxy):
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = ""
        mock_proxy.return_value = mock_response
        with self.feature(PROFILING_FEATURES):
            response = self.client.get(self.url, {"sort": "count"})
        assert response.status_code == 500
