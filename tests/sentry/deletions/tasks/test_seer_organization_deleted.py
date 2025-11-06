from typing import Any
from unittest.mock import patch

import pytest

from sentry.deletions.tasks.seer_organization_deleted import notify_seer_organization_deleted
from sentry.seer.code_review.utils import SeerEndpoint
from sentry.testutils.cases import TestCase


class NotifySeerOrganizationDeletedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization_id = 12345

    @patch("sentry.deletions.tasks.seer_organization_deleted.make_seer_request")
    @patch("sentry.deletions.tasks.seer_organization_deleted.logger")
    def test_notifies_seer_via_signed_code_review_endpoint(
        self, mock_logger: Any, mock_make_seer_request: Any
    ) -> None:
        mock_make_seer_request.return_value = b"{}"

        notify_seer_organization_deleted(self.organization_id)

        mock_make_seer_request.assert_called_once()
        kwargs = mock_make_seer_request.call_args.kwargs
        assert kwargs["path"] == SeerEndpoint.ORGANIZATION_OFFBOARD.value
        assert kwargs["payload"] == {"organization_id": self.organization_id}
        assert kwargs["viewer_context"]["organization_id"] == self.organization_id

        mock_logger.info.assert_called_once_with(
            "seer.organization_deleted.success",
            extra={"organization_id": self.organization_id},
        )

    @patch("sentry.deletions.tasks.seer_organization_deleted.make_seer_request")
    def test_propagates_seer_errors(self, mock_make_seer_request: Any) -> None:
        mock_make_seer_request.side_effect = RuntimeError("seer unavailable")

        with pytest.raises(RuntimeError, match="seer unavailable"):
            notify_seer_organization_deleted(self.organization_id)

        mock_make_seer_request.assert_called_once()
