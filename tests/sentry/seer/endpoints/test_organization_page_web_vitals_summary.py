import datetime
from unittest.mock import ANY, patch

from rest_framework.exceptions import ErrorDetail

from sentry.snuba.trace import SerializedSpan
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:performance-web-vitals-seer-suggestions")
class OrganizationPageWebVitalsSummaryEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        self.trace_id = "trace123"
        self.mock_trace_tree = [
            SerializedSpan(
                description="connect",
                name="browser",
                event_id="span1",
                event_type="span",
                project_id=1,
                project_slug="test-project",
                start_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 0),
                transaction="test_transaction",
                children=[],
                errors=[],
                occurrences=[],
                duration=100.0,
                end_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 1),
                measurements={},
                op="browser",
                parent_span_id=None,
                profile_id="",
                profiler_id="",
                sdk_name="test_sdk",
                is_transaction=False,
                transaction_id="1" * 32,
            ),
            SerializedSpan(
                description="Main UI thread blocked",
                name="ui.long-task",
                event_id="span2",
                event_type="span",
                project_id=1,
                project_slug="test-project",
                start_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 0),
                transaction="test_transaction",
                children=[],
                errors=[],
                occurrences=[],
                duration=50.0,
                end_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 1),
                measurements={},
                op="ui.long-task",
                parent_span_id=None,
                profile_id="",
                profiler_id="",
                sdk_name="test_sdk",
                is_transaction=False,
                transaction_id="1" * 32,
            ),
        ]
        self.mock_summary_response = {
            "traceIds": [self.trace_id],
            "suggestedInvestigations": [
                {
                    "explanation": "Long task is blocking the main thread.",
                    "spanId": "1" * 18,
                    "spanOp": "ui.long-task",
                    "traceId": self.trace_id,
                    "suggestions": ["Optimize."],
                    "referenceUrl": "https://web.dev/",
                },
            ],
        }

        self.url = self._get_url()

    def _get_url(self):
        return f"/api/0/organizations/{self.org.slug}/page-web-vitals-summary/"

    @patch("sentry.seer.endpoints.organization_page_web_vitals_summary.get_page_web_vitals_summary")
    @patch(
        "sentry.seer.endpoints.organization_page_web_vitals_summary.OrganizationPageWebVitalsSummaryEndpoint.get_snuba_params"
    )
    @patch("sentry.seer.endpoints.organization_page_web_vitals_summary.query_trace_data")
    def test_endpoint_calls_get_page_web_vitals_summary(
        self, mock_query_trace_data, mock_get_snuba_params, mock_get_page_web_vitals_summary
    ):
        mock_query_trace_data.return_value = self.mock_trace_tree
        mock_get_snuba_params.return_value = {}
        mock_get_page_web_vitals_summary.return_value = (self.mock_summary_response, 200)

        response = self.client.post(
            self.url,
            data={"traceSlugs": [self.trace_id]},
            format="json",
        )

        assert response.status_code == 200
        assert response.data == self.mock_summary_response

        mock_query_trace_data.assert_called_once()
        mock_get_page_web_vitals_summary.assert_called_once_with(
            traceSlugs=[self.trace_id],
            traceTrees=[self.mock_trace_tree],
            organization=self.org,
            user=ANY,
        )

    def test_endpoint_without_trace_slug(self):
        response = self.client.post(self.url, format="json")
        assert response.status_code == 400
        assert response.data == {
            "traceSlugs": [ErrorDetail(string="This field is required.", code="required")],
        }

    @patch(
        "sentry.seer.endpoints.organization_page_web_vitals_summary.OrganizationPageWebVitalsSummaryEndpoint.get_snuba_params"
    )
    @patch("sentry.seer.endpoints.organization_page_web_vitals_summary.query_trace_data")
    def test_endpoint_with_error_response(self, mock_query_trace_data, mock_get_snuba_params):
        mock_get_snuba_params.return_value = {}
        mock_query_trace_data.side_effect = Exception("Test exception")
        response = self.client.post(self.url, data={"traceSlugs": [self.trace_id]}, format="json")
        assert response.status_code == 500
        assert response.data == {"detail": "Internal Error", "errorId": None}

    @patch(
        "sentry.seer.endpoints.organization_page_web_vitals_summary.OrganizationPageWebVitalsSummaryEndpoint.get_snuba_params"
    )
    @patch("sentry.seer.endpoints.organization_page_web_vitals_summary.query_trace_data")
    def test_endpoint_with_missing_trace_tree(self, mock_query_trace_data, mock_get_snuba_params):
        mock_get_snuba_params.return_value = {}
        mock_query_trace_data.return_value = []
        response = self.client.post(self.url, data={"traceSlugs": [self.trace_id]}, format="json")
        assert response.status_code == 400
        assert response.data == {"detail": "Missing trace_trees data"}
