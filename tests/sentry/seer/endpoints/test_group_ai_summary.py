from unittest.mock import ANY, MagicMock, patch

from django.test import override_settings

from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.exceptions import (
    IssueSummaryEventNotFound,
    IssueSummaryHidden,
    IssueSummarySelfHosted,
)
from sentry.seer.models import IssueSummary
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]


@override_settings(SENTRY_SELF_HOSTED=False)
class GroupAiSummaryEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.url = self._get_url(self.group.id)
        self.login_as(user=self.user)

    def _get_url(self, group_id: int) -> str:
        return f"/api/0/organizations/{self.organization.slug}/issues/{group_id}/summarize/"

    @patch("sentry.seer.endpoints.group_ai_summary.get_or_generate_issue_summary")
    @patch("sentry.seer.endpoints.group_ai_summary.generate_issue_summary")
    def test_endpoint_generates_for_explicit_event_id(
        self, mock_generate_issue_summary: MagicMock, mock_get_or_generate_summary: MagicMock
    ) -> None:
        mock_summary_data = IssueSummary(
            group_id=str(self.group.id),
            event_id="test_event_id",
            headline="Test headline",
        )
        mock_generate_issue_summary.return_value = mock_summary_data

        response = self.client.post(self.url, data={"event_id": "test_event_id"}, format="json")

        assert response.status_code == 200
        assert response.data["headline"] == mock_summary_data.headline
        assert response.data["groupId"] == mock_summary_data.group_id
        assert response.data["eventId"] == mock_summary_data.event_id
        mock_get_or_generate_summary.assert_not_called()
        mock_generate_issue_summary.assert_called_once_with(
            group=self.group,
            user=ANY,
            force_event_id="test_event_id",
            source=SeerAutomationSource.ISSUE_DETAILS,
        )

    @patch("sentry.seer.endpoints.group_ai_summary.get_or_generate_issue_summary")
    @patch("sentry.seer.endpoints.group_ai_summary.generate_issue_summary")
    def test_endpoint_gets_or_generates_summary(
        self, mock_generate_issue_summary: MagicMock, mock_get_or_generate_summary: MagicMock
    ) -> None:
        mock_summary_data = IssueSummary(
            group_id=str(self.group.id),
            event_id="test_event_id",
            headline="Test headline",
        )
        mock_get_or_generate_summary.return_value = mock_summary_data

        response = self.client.post(self.url, format="json")

        assert response.status_code == 200
        assert response.data["headline"] == mock_summary_data.headline
        mock_get_or_generate_summary.assert_called_once_with(
            group=self.group, user=ANY, source=SeerAutomationSource.ISSUE_DETAILS
        )
        mock_generate_issue_summary.assert_not_called()

    @patch("sentry.seer.endpoints.group_ai_summary.get_or_generate_issue_summary")
    def test_endpoint_returns_bad_request_for_unavailable_summary(
        self, mock_get_or_generate_summary: MagicMock
    ) -> None:
        mock_get_or_generate_summary.side_effect = IssueSummaryEventNotFound("internal context")

        response = self.client.post(self.url, format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Could not find an event for the issue"}
        mock_get_or_generate_summary.assert_called_once_with(
            group=self.group,
            user=ANY,
            source=SeerAutomationSource.ISSUE_DETAILS,
        )

    @patch("sentry.seer.endpoints.group_ai_summary.get_or_generate_issue_summary")
    def test_endpoint_returns_bad_request_when_self_hosted(
        self, mock_get_issue_summary: MagicMock
    ) -> None:
        mock_get_issue_summary.side_effect = IssueSummarySelfHosted("internal context")

        response = self.client.post(self.url, format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Seer is not available on this installation."}

    @patch("sentry.seer.endpoints.group_ai_summary.get_or_generate_issue_summary")
    def test_endpoint_returns_forbidden_when_ai_is_hidden(
        self, mock_get_issue_summary: MagicMock
    ) -> None:
        mock_get_issue_summary.side_effect = IssueSummaryHidden("internal context")

        response = self.client.post(self.url, format="json")

        assert response.status_code == 403
        assert response.data == {"detail": "AI features are disabled for this organization."}

    @patch("sentry.seer.endpoints.group_ai_summary.get_or_generate_issue_summary")
    def test_endpoint_returns_unavailable_for_lock_timeout(
        self, mock_get_or_generate_summary: MagicMock
    ) -> None:
        mock_get_or_generate_summary.side_effect = UnableToAcquireLock

        response = self.client.post(self.url, format="json")

        assert response.status_code == 503
        assert response.data == {"detail": "Timeout waiting for summary generation lock"}
