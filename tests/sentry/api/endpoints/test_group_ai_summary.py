from unittest.mock import ANY, patch

from sentry.autofix.utils import SeerAutomationSource
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:gen-ai-features")
class GroupAiSummaryEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.group = self.create_group()
        self.url = self._get_url(self.group.id)
        self.login_as(user=self.user)

    def _get_url(self, group_id: int):
        return f"/api/0/issues/{group_id}/summarize/"

    @patch("sentry.api.endpoints.group_ai_summary.get_issue_summary")
    def test_endpoint_calls_get_issue_summary(self, mock_get_issue_summary):
        mock_summary_data = {"headline": "Test headline"}
        mock_get_issue_summary.return_value = (mock_summary_data, 200)

        response = self.client.post(self.url, data={"event_id": "test_event_id"}, format="json")

        assert response.status_code == 200
        assert response.data == mock_summary_data
        mock_get_issue_summary.assert_called_once_with(
            group=self.group,
            user=ANY,
            force_event_id="test_event_id",
            source=SeerAutomationSource.ISSUE_DETAILS,
        )

    @patch("sentry.api.endpoints.group_ai_summary.get_issue_summary")
    def test_endpoint_without_event_id(self, mock_get_issue_summary):
        mock_summary_data = {"headline": "Test headline"}
        mock_get_issue_summary.return_value = (mock_summary_data, 200)

        response = self.client.post(self.url, format="json")

        assert response.status_code == 200
        assert response.data == mock_summary_data
        mock_get_issue_summary.assert_called_once_with(
            group=self.group,
            user=ANY,
            force_event_id=None,
            source=SeerAutomationSource.ISSUE_DETAILS,
        )

    @patch("sentry.api.endpoints.group_ai_summary.get_issue_summary")
    def test_endpoint_with_error_response(self, mock_get_issue_summary):
        error_data = {"detail": "An error occurred"}
        mock_get_issue_summary.return_value = (error_data, 400)

        response = self.client.post(self.url, format="json")

        assert response.status_code == 400
        assert response.data == error_data
        mock_get_issue_summary.assert_called_once_with(
            group=self.group,
            user=ANY,
            force_event_id=None,
            source=SeerAutomationSource.ISSUE_DETAILS,
        )
