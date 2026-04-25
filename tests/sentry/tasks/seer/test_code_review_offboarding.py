from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.seer.code_review.utils import ClientError
from sentry.tasks.seer.code_review_offboarding import notify_code_review_organization_offboarded
from sentry.testutils.cases import TestCase


class TestNotifyCodeReviewOrganizationOffboarded(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()

    @patch("sentry.tasks.seer.code_review_offboarding.make_seer_request")
    def test_calls_seer_with_org_id(self, mock_request: MagicMock) -> None:
        mock_request.return_value = b"{}"

        notify_code_review_organization_offboarded(organization_id=self.organization.id)

        mock_request.assert_called_once()
        kwargs = mock_request.call_args.kwargs
        assert kwargs["payload"] == {"organization_id": self.organization.id}
        assert kwargs["viewer_context"] == {"organization_id": self.organization.id}

    @patch("sentry.tasks.seer.code_review_offboarding.make_seer_request")
    def test_swallows_client_error(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = ClientError("Seer returned client error 404")

        notify_code_review_organization_offboarded(organization_id=self.organization.id)

        mock_request.assert_called_once()
