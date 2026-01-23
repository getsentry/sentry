from unittest.mock import ANY, MagicMock, patch

from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@with_feature("organizations:gen-ai-features")
class GroupAiSummaryEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.url = self._get_url(self.group.id)
        self.login_as(user=self.user)

    def _get_url(self, group_id: int) -> str:
        return f"/api/0/organizations/{self.organization.slug}/issues/{group_id}/summarize/"

    @patch("sentry.seer.endpoints.group_ai_summary.get_issue_summary")
    def test_endpoint_calls_get_issue_summary(self, mock_get_issue_summary: MagicMock) -> None:
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

    @patch("sentry.seer.endpoints.group_ai_summary.get_issue_summary")
    def test_endpoint_without_event_id(self, mock_get_issue_summary: MagicMock) -> None:
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

    @patch("sentry.seer.endpoints.group_ai_summary.get_issue_summary")
    def test_endpoint_with_error_response(self, mock_get_issue_summary: MagicMock) -> None:
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
