from typing import Any
from unittest.mock import patch

import pytest

from sentry.deletions.tasks.seer import notify_seer_repository_deleted
from sentry.seer.code_review.utils import SeerEndpoint
from sentry.testutils.cases import TestCase


class NotifySeerRepositoryDeletedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization_id = 12345
        self.repository_id = 67890
        self.provider = "integrations:github"
        self.repository_name = "acme/widget"

    @patch("sentry.seer.code_review.utils.make_seer_request")
    def test_notifies_seer_via_signed_endpoint(self, mock_make_seer_request: Any) -> None:
        mock_make_seer_request.return_value = b"{}"

        notify_seer_repository_deleted(
            self.organization_id,
            self.repository_id,
            self.provider,
            self.repository_name,
        )

        mock_make_seer_request.assert_called_once()
        kwargs = mock_make_seer_request.call_args.kwargs
        assert kwargs["path"] == SeerEndpoint.REPOSITORY_OFFBOARD.value
        assert kwargs["payload"] == {
            "organization_id": self.organization_id,
            "repository_id": self.repository_id,
            "provider": self.provider,
            "repository_name": self.repository_name,
        }
        assert kwargs["viewer_context"]["organization_id"] == self.organization_id

    @patch("sentry.seer.code_review.utils.make_seer_request")
    def test_propagates_seer_errors(self, mock_make_seer_request: Any) -> None:
        mock_make_seer_request.side_effect = RuntimeError("seer unavailable")

        with pytest.raises(RuntimeError, match="seer unavailable"):
            notify_seer_repository_deleted(
                self.organization_id,
                self.repository_id,
                self.provider,
                self.repository_name,
            )

        mock_make_seer_request.assert_called_once()
