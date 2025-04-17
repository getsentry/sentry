from unittest.mock import ANY, patch

from rest_framework.response import Response

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:single-trace-summary")
@apply_feature_flag_on_cls("organizations:trace-spans-format")
class OrganizationTraceSummaryEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        self.trace_id = "trace123"
        self.mock_trace_tree = [
            {"span_id": "span1", "operation_name": "http.request", "duration_ms": 100},
            {"span_id": "span2", "operation_name": "db.query", "duration_ms": 50},
        ]

        self.mock_summary_response = {
            "trace_id": self.trace_id,
            "summary": "Test summary of the trace",
            "key_observations": "Test key observations of the trace",
            "performance_characteristics": "Test performance characteristics of the trace",
            "suggested_investigations": "Test suggested investigations of the trace",
        }

        self.url = self._get_url()

    def _get_url(self):
        return f"/api/0/organizations/{self.org.slug}/trace-summary/"

    @patch("sentry.api.endpoints.organization_trace_summary.get_trace_summary")
    @patch("sentry.api.endpoints.organization_trace_summary.OrganizationTraceEndpoint")
    def test_endpoint_calls_get_trace_summary(
        self, mock_trace_endpoint_class, mock_get_trace_summary
    ):
        mock_trace_endpoint_class.return_value.get.return_value = Response(
            data=self.mock_trace_tree
        )

        mock_get_trace_summary.return_value = (self.mock_summary_response, 200)

        response = self.client.post(
            self.url,
            data={"traceSlug": self.trace_id},
            format="json",
        )

        assert response.status_code == 200
        assert response.data == self.mock_summary_response

        mock_trace_endpoint_class.assert_called_once()
        mock_get_trace_summary.assert_called_once_with(
            traceSlug=self.trace_id,
            traceTree=self.mock_trace_tree,
            organization=self.org,
            user=ANY,
            onlyTransaction=False,
        )

    def test_endpoint_without_trace_slug(self):
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data == {"detail": "Missing traceSlug parameter"}

    @patch("sentry.api.endpoints.organization_trace_summary.OrganizationTraceEndpoint")
    def test_endpoint_with_error_response(self, mock_trace_endpoint_class):
        mock_trace_endpoint_class.return_value.get.side_effect = Exception("Test exception")
        response = self.client.post(self.url, data={"traceSlug": self.trace_id}, format="json")
        assert response.status_code == 400
        assert response.data == {"detail": "Error fetching trace"}

    @patch("sentry.api.endpoints.organization_trace_summary.get_trace_summary")
    def test_endpoint_with_missing_trace_tree(self, mock_organization_trace_endpoint):
        mock_organization_trace_endpoint.return_value.get.return_value = Response([], status=200)
        response = self.client.post(self.url, data={"traceSlug": self.trace_id}, format="json")
        assert response.status_code == 400
        assert response.data == {"detail": "Missing trace_tree data"}
